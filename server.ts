import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { PathResponse } from "./src/types";

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy-initialize Gemini API Client with a check for API Key presence
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error(
        "GEMINI_API_KEY is not configured. Please set your Gemini API key in the Settings > Secrets panel of Google AI Studio."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Define the response schema using @google/genai Type enum
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    risk_level: {
      type: Type.STRING,
      description: "Assess the risk level of missing the deadline/goal. MUST be either: 'Low', 'Medium', or 'High'.",
    },
    minimum_viable_outcome: {
      type: Type.STRING,
      description: "The absolute minimum standard of success (Minimum Viable Outcome) to satisfy the goal. Be specific and highly realistic.",
    },
    must_do: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3-5 critical, non-negotiable, highest-impact tasks that MUST be done to achieve the minimum outcome.",
    },
    skip: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of tasks, distractions, or perfectionist details that should be actively skipped, postponed, or ignored to guarantee completion.",
    },
    next_action: {
      type: Type.STRING,
      description: "The single, extremely small physical action the user can do in the next 3 minutes to break procrastination and build immediate momentum (e.g., 'Open a blank Google slide and type the title').",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Actionable, clear step title." },
          description: { type: Type.STRING, description: "Actionable details or specific guidance for this step." },
          estimated_minutes: { type: Type.INTEGER, description: "Estimated completion time in minutes." },
        },
        required: ["title", "description", "estimated_minutes"],
      },
      description: "The step-by-step path structured chronologically. Keep them tight and focused.",
    },
    efficiency_quote: {
      type: Type.STRING,
      description: "A short, clever, motivational or tactical productivity tip specific to this task.",
    },
    estimated_total_hours: {
      type: Type.NUMBER,
      description: "Sum of estimated steps in hours, rounded to 1 decimal place.",
    },
  },
  required: [
    "risk_level",
    "minimum_viable_outcome",
    "must_do",
    "skip",
    "next_action",
    "steps",
    "efficiency_quote",
    "estimated_total_hours",
  ],
};

// Helper function to generate high-quality tactical plans locally if Gemini API is rate-limited or unavailable
function generateLocalFallbackPath(task: string, availableHours: number | null, deadlineDate: string | null): PathResponse & { is_fallback: boolean } {
  let normalizedTask = task.trim();
  const lowerTask = task.toLowerCase();
  
  // Intelligent Input Normalization
  if (lowerTask.includes("colklege") || lowerTask.includes("plkacements") || (lowerTask.includes("coding round") && lowerTask.includes("placement"))) {
    normalizedTask = "Coding round in college for placements";
  } else if (lowerTask.includes("mathematics2") || (lowerTask.includes("ch 4") && lowerTask.includes("ch1"))) {
    normalizedTask = "Complete Mathematics 2 Chapter 4 and Chapter 1";
  } else if (lowerTask.includes("dbms imp q") || (lowerTask.includes("dbms") && lowerTask.includes("imp"))) {
    normalizedTask = "Study important DBMS questions";
  } else if (lowerTask.includes("os viva") || (lowerTask.includes("os") && lowerTask.includes("viva"))) {
    normalizedTask = "Prepare for Operating Systems viva";
  }

  const normalized = normalizedTask.toLowerCase();
  let category = "General Tasks";
  let rawSteps: Array<{ title: string; desc: string; weight: number }> = [];

  if (normalized.includes("placement") || normalized.includes("dsa") || normalized.includes("leetcode") || normalized.includes("coding round") || normalized.includes("coding interview") || normalized.includes("data structure") || normalized.includes("algorithm")) {
    category = "Coding Interview / Placement Preparation";
    rawSteps = [
      {
        title: "🧠 High-Yield DSA & Patterns Review",
        desc: "[Priority: Critical - targets maximum probability patterns] Focus intensely on core patterns: Arrays, HashMaps, Two Pointers, and recursion.",
        weight: 0.15,
      },
      {
        title: "💻 Active Mock Solving & Dry-Runs",
        desc: "[Priority: Critical - builds real interview muscle] Solve 3-5 medium-level LeetCode problems. Write code on a whiteboard or paper and dry-run with test cases.",
        weight: 0.35,
      },
      {
        title: "🗣️ Behavioral & Elevator Pitch Practice",
        desc: "[Priority: High - secures non-technical evaluation points] Practice your self-introduction, project explanations, and STAR-method behavioral responses.",
        weight: 0.35,
      },
      {
        title: "📝 Quick Review of Cheat Sheets & Big-O",
        desc: "[Priority: Medium - prevents minor slip-ups] Quickly review space-time complexities, sorting algorithms, and standard coding templates.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("dbms") || normalized.includes("operating system") || normalized.includes("computer network") || normalized.includes("lecture") || normalized.includes("syllabus") || normalized.includes("semester") || normalized.includes("college") || normalized.includes("university")) {
    category = "College Study";
    rawSteps = [
      {
        title: "📚 Syllabus Triage & Concept Mapping",
        desc: "[Priority: Critical - defines what is on the test] Skim syllabus, chapter summaries, and lecture slides. Highlight 5 core concepts that carry 80% weight.",
        weight: 0.15,
      },
      {
        title: "🧠 High-Intensity Concept Learning",
        desc: "[Priority: Critical - overcomes understanding barriers] Study the core theories, definitions, and diagrams using active recall or the Feynman Technique.",
        weight: 0.35,
      },
      {
        title: "📝 Review Exercises & Solved Examples",
        desc: "[Priority: High - builds application fluency] Go through end-of-chapter questions and solved numericals. Do not just read them; try to solve them actively.",
        weight: 0.35,
      },
      {
        title: "✨ Flashcard Revision & Formulas",
        desc: "[Priority: Medium - locks down active retention] Create a 1-page formula sheet or quick flashcards of hard terms for a final active revision pass.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("exam") || normalized.includes("test") || normalized.includes("quiz") || normalized.includes("certification") || normalized.includes("final") || normalized.includes("midterm") || normalized.includes("grade")) {
    category = "Exam Preparation";
    rawSteps = [
      {
        title: "📝 Past Papers & High-Yield Questions",
        desc: "[Priority: Critical - gets you familiar with exam format] Gather previous year papers or sample tests. Attempt them under strict timed conditions to practice pacing.",
        weight: 0.20,
      },
      {
        title: "🔍 Weak-Spot Diagnostic & Patching",
        desc: "[Priority: Critical - prevents recurring mistakes] Analyze wrong answers from mock practice. Re-read target chapters and patch memory gaps immediately.",
        weight: 0.35,
      },
      {
        title: "📋 Quick-Reference Sheet Compilation",
        desc: "[Priority: High - final checklist stabilization] Write down key formulas, dates, definitions, and standard responses on a single cheat sheet.",
        weight: 0.30,
      },
      {
        title: "🧘 Timing & Mental Prep Walkthrough",
        desc: "[Priority: Medium - ensures composure during test] Map out exactly how much time to spend on section A, B, and C. Plan a resting interval pattern.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("assignment") || normalized.includes("homework") || normalized.includes("practical") || normalized.includes("lab file") || normalized.includes("project report")) {
    category = "Assignment";
    rawSteps = [
      {
        title: "📋 Spec Analysis & Outline Design",
        desc: "[Priority: Critical - guarantees grading rubric compliance] Read the assignment instructions and rubric carefully. Create a structured outline adhering to exact headings.",
        weight: 0.15,
      },
      {
        title: "✍️ Draft Drafting (Focus on Content)",
        desc: "[Priority: Critical - breaks starting resistance] Write or build the core assignment parts continuous and fast. Do not edit or format during this block.",
        weight: 0.40,
      },
      {
        title: "🔧 Formatting, Citations & Guidelines Check",
        desc: "[Priority: High - secures easy presentation marks] Apply required font, margins, numbering, and integrate accurate academic citations/references.",
        weight: 0.30,
      },
      {
        title: "🔍 Rubric Alignment Walkthrough",
        desc: "[Priority: Medium - final safety check] Read through your assignment once against the original prompt or rubric to ensure zero missing elements.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("interview") || normalized.includes("resume") || normalized.includes("cv") || normalized.includes("job") || normalized.includes("hr round") || normalized.includes("linkedin") || normalized.includes("hire") || normalized.includes("recruiter")) {
    category = "Job Preparation";
    rawSteps = [
      {
        title: "🎯 Job Description & Resume Alignment",
        desc: "[Priority: Critical - matches you to the role] Analyze the target role. Tweak your resume bullet points to highlight matching achievements and keywords.",
        weight: 0.15,
      },
      {
        title: "🎤 Master Core Tell-Me-About-Yourself Pitch",
        desc: "[Priority: Critical - first impressions count] Polish and deliver a 90-second professional narrative. Record yourself and adjust tone, pace, and body language.",
        weight: 0.35,
        },
      {
        title: "📋 Technical & Behavioral Q&A Review",
        desc: "[Priority: High - prevents brain freeze] Prepare concise answers for common situational questions (conflict, failure, teamwork) and technical fundamentals.",
        weight: 0.35,
      },
      {
        title: "💼 Company & Interviewer Research",
        desc: "[Priority: Medium - demonstrates high engagement] Read the company's recent news, tech stack, and check your interviewers' LinkedIn profiles to find connection points.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("business") || normalized.includes("pitch") || normalized.includes("startup") || normalized.includes("deck") || normalized.includes("venture") || normalized.includes("investor") || normalized.includes("marketing plan") || normalized.includes("slide") || normalized.includes("presentation") || normalized.includes("talk")) {
    category = "Business / Startup";
    rawSteps = [
      {
        title: "💡 Value Proposition & Core Hypothesis",
        desc: "[Priority: Critical - clarifies the entire venture] Define the core problem, your unique solution, target audience, and the revenue model in 3 simple sentences.",
        weight: 0.15,
      },
      {
        title: "📊 Lean Market Validation & Data Gathering",
        desc: "[Priority: High - supports pitch with evidence] Search 3-5 competitor models, calculate estimated TAM (Total Addressable Market), and compile proof of demand.",
        weight: 0.25,
      },
      {
        title: "🖼️ Pitch Deck Storyboard & Slides",
        desc: "[Priority: Critical - main communication tool] Design a 10-slide deck (Problem, Solution, Product, Market, Traction, Team, Financials). Use high-contrast minimal slides.",
        weight: 0.45,
      },
      {
        title: "🗣️ Pitch Run-Through & Q&A Prep",
        desc: "[Priority: Medium - guarantees smooth presentation delivery] Practice speaking over your slides within a strict timer (e.g., 5 mins). Draft answers to 5 hardest potential questions.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("research") || normalized.includes("thesis") || normalized.includes("dissertation") || normalized.includes("paper") || normalized.includes("literature review")) {
    category = "Research";
    rawSteps = [
      {
        title: "🔍 Literature Search & Source Triage",
        desc: "[Priority: Critical - establishes rigorous foundation] Collect 5-10 high-impact papers via Google Scholar. Read only abstracts, introductions, and conclusions.",
        weight: 0.15,
      },
      {
        title: "📝 Structured Note Synthesis & Matrix",
        desc: "[Priority: High - translates research into structured insight] Group findings by main themes, find contradictions, and construct a structured literature matrix.",
        weight: 0.30,
      },
      {
        title: "✍️ Drafting Research Sections & Method",
        desc: "[Priority: Critical - documents the core contribution] Write the methodology and results/discussion sections. Support every major claim with standard academic citations.",
        weight: 0.40,
      },
      {
        title: "🔧 Citations Check & Formatting Pass",
        desc: "[Priority: Medium - ensures academic compliance] Double-check APA/MLA format, organize bibliography, and fix page/figure captions.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("content") || normalized.includes("video") || normalized.includes("script") || normalized.includes("blog") || normalized.includes("podcast") || normalized.includes("design") || normalized.includes("ui") || normalized.includes("logo") || normalized.includes("figma") || normalized.includes("vector") || normalized.includes("art") || normalized.includes("creative")) {
    category = "Content Creation";
    rawSteps = [
      {
        title: "💡 Ideation, Hook, & Outline Design",
        desc: "[Priority: Critical - hooks viewer attention] Script an attention-grabbing first 5 seconds (the hook). Map out the content body structure with 3 key pillars.",
        weight: 0.15,
      },
      {
        title: "✍️ Scripting, Storyboarding, or Drafting",
        desc: "[Priority: Critical - provides the execution guide] Write down the complete voiceover transcript, camera angles, or design layout wireframes.",
        weight: 0.35,
      },
      {
        title: "🎨 Media Asset Collection & Creation",
        desc: "[Priority: High - builds the visual assets] Record audio/video clips, search high-quality royalty-free graphics/B-roll, or assemble vector layouts in Figma.",
        weight: 0.35,
      },
      {
        title: "🎬 Editing, Sound Mix & Export Check",
        desc: "[Priority: Medium - final engagement polish] Cut out dead spaces, add captions, mix background audio levels, and export in optimal format (e.g., MP4/SVG).",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("productivity") || normalized.includes("habit") || normalized.includes("routine") || normalized.includes("clean") || normalized.includes("organize") || normalized.includes("declutter") || normalized.includes("workout") || normalized.includes("schedule") || normalized.includes("exercise") || normalized.includes("sleep")) {
    category = "Personal Productivity";
    rawSteps = [
      {
        title: "🧹 Focus Area Triage & Goal Declutter",
        desc: "[Priority: Critical - clears mental overload] Choose ONLY the single highest-value habit or space. Define exactly what 'done' looks like for today.",
        weight: 0.15,
      },
      {
        title: "⚡ Action-Trigger & Friction Reduction",
        desc: "[Priority: Critical - makes starting inevitable] Place physical tools in sight (e.g. running shoes, water, journal). Remove digital distractions by setting a focus blocker.",
        weight: 0.25,
      },
      {
        title: "🏗️ Execution in Micro-Sprints",
        desc: "[Priority: High - builds momentum slowly] Work or clean for 15-20 minutes with zero exceptions. Focus purely on process, not on perfect completion.",
        weight: 0.45,
      },
      {
        title: "📝 Reflection, Logging & Streak Track",
        desc: "[Priority: Medium - reinforces positive feedback loops] Document your work, mark it done in a tracker, and celebrate the small win to stabilize the routine.",
        weight: 0.15,
      }
    ];
  } else if (normalized.includes("code") || normalized.includes("program") || normalized.includes("app") || normalized.includes("website") || normalized.includes("bug") || normalized.includes("software") || normalized.includes("develop") || normalized.includes("api") || normalized.includes("database") || normalized.includes("build") || normalized.includes("react") || normalized.includes("html") || normalized.includes("css") || normalized.includes("frontend") || normalized.includes("backend")) {
    category = "Software Development";
    rawSteps = [
      {
        title: "🏗️ System Architecture & Setup",
        desc: "[Priority: Critical - avoids downstream compilation and structure issues] Initialize repository, package setup, define schema, and verify initial server boot.",
        weight: 0.15,
      },
      {
        title: "⚙️ Core Logic & API Engineering",
        desc: "[Priority: Critical - powers main business functions] Develop primary backend routes, integrate service layers, and test basic database operations.",
        weight: 0.35,
      },
      {
        title: "🎨 Frontend UI Integration & State",
        desc: "[Priority: High - makes functionality accessible to end-user] Build clean components, wire up API requests, and implement fluid local state management.",
        weight: 0.35,
      },
      {
        title: "🧪 End-to-End Testing & Polish",
        desc: "[Priority: Medium - ensures bug-free execution under pressure] Run visual pass, edge-case sanity checks, and eliminate console warnings.",
        weight: 0.15,
      }
    ];
  } else {
    category = "General Tasks";
    rawSteps = [
      {
        title: "🎯 Ruthless Scope Triage",
        desc: "[Priority: Critical - prevents scope creep] Define the absolute thinnest slice of success. Document what is out of scope immediately.",
        weight: 0.15,
      },
      {
        title: "🏗️ High-Impact Execution Blocks",
        desc: "[Priority: Critical - gets the primary mechanics working] Build, execute, or draft the core engine that carries 80% of the value.",
        weight: 0.45,
      },
      {
        title: "🛠️ Integration & Interface Styling",
        desc: "[Priority: High - bridges individual components] Bind parts together, refine visual presentation, and correct loose layout spacing.",
        weight: 0.25,
      },
      {
        title: "🔍 Final Walkthrough & Polish",
        desc: "[Priority: Medium - guarantees professional handover] Perform final visual walkthrough, clean comments, and verify compliance.",
        weight: 0.15,
      }
    ];
  }

  const hours = availableHours || 4.0;
  const totalMinutes = Math.round(hours * 60);

  const numBreaks = totalMinutes <= 90 ? 0 : totalMinutes <= 180 ? 1 : totalMinutes <= 300 ? 2 : 3;
  const breakDuration = 10;
  const totalBreakMinutes = numBreaks * breakDuration;
  const activeWorkMinutes = Math.max(30, totalMinutes - totalBreakMinutes);

  let steps: Array<{ title: string; description: string; estimated_minutes: number }> = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const raw = rawSteps[i];
    const stepMin = Math.round(activeWorkMinutes * raw.weight);
    
    if (stepMin > 90) {
      const part1 = Math.round(stepMin / 2);
      const part2 = stepMin - part1;
      steps.push({
        title: `${raw.title} (Part 1)`,
        description: `${raw.desc} (Focus Block Part 1).`,
        estimated_minutes: part1,
      });
      steps.push({
        title: `${raw.title} (Part 2)`,
        description: `${raw.desc} (Focus Block Part 2).`,
        estimated_minutes: part2,
      });
    } else {
      steps.push({
        title: raw.title,
        description: raw.desc,
        estimated_minutes: stepMin || 15,
      });
    }
  }

  if (numBreaks > 0) {
    const finalSteps: typeof steps = [];
    const breakPositions = new Set<number>();
    if (numBreaks === 1) {
      breakPositions.add(Math.floor(steps.length / 2));
    } else if (numBreaks === 2) {
      breakPositions.add(Math.floor(steps.length / 3));
      breakPositions.add(Math.floor((steps.length * 2) / 3));
    } else {
      for (let b = 1; b <= numBreaks; b++) {
        breakPositions.add(Math.floor((steps.length * b) / (numBreaks + 1)));
      }
    }

    for (let i = 0; i < steps.length; i++) {
      finalSteps.push(steps[i]);
      if (breakPositions.has(i + 1) && i < steps.length - 1) {
        finalSteps.push({
          title: "⏸️ Rest & Recharge Break",
          description: "[Priority: Critical for cognitive recovery] Hydrate, stretch, and rest your eyes. Step away from your screens for optimal cognitive recovery.",
          estimated_minutes: breakDuration,
        });
      }
    }
    steps = finalSteps;
  }

  const totalStepMinutes = steps.reduce((sum, s) => sum + s.estimated_minutes, 0);
  const estimated_total_hours = parseFloat((totalStepMinutes / 60).toFixed(1));

  let efficiency_quote = "";
  if (hours <= 2) {
    efficiency_quote = "Focus Strategy: Pomodoro Sprints - Work intensely for 25-minute blocks followed by a 5-minute rest. Tackle high-urgency bottlenecks first and maintain hyper-focus to beat the clock.";
  } else if (hours <= 6) {
    efficiency_quote = "Focus Strategy: Time Boxing - Divide your total available block into rigid, fixed timeboxes for each primary task. Respect the boundaries of each box to prevent perfectionism and maintain rapid momentum.";
  } else {
    efficiency_quote = "Focus Strategy: Deep Work Blocks - Isolate yourself, disable all mobile notifications, and commit to 90-120 minute uninterrupted deep work blocks. Protect your cognitive bandwidth fiercely.";
  }

  const isHeavyTask = normalized.includes("app") || normalized.includes("website") || normalized.includes("thesis") || normalized.includes("dissertation") || normalized.includes("exam") || normalized.includes("software") || normalized.includes("database");
  const isOverloaded = (availableHours !== null && isHeavyTask && availableHours < 5) || (availableHours !== null && availableHours <= 1.5);

  let risk_level: "Low" | "Medium" | "High" = "Low";
  if (isOverloaded) {
    risk_level = "High";
  } else if (availableHours !== null && availableHours < 4) {
    risk_level = "Medium";
  } else {
    risk_level = "Low";
  }

  let minimum_viable_outcome = "";
  const targetMvo = `A streamlined, focused blueprint focusing strictly on core mechanics for "${normalizedTask}"`;

  if (isOverloaded) {
    minimum_viable_outcome = `⚠️ SCHEDULE OVERLOAD WARNING: Trying to complete a complex task like "${normalizedTask}" in just ${availableHours} hour(s) presents a high failure risk. 
REALISTIC ADJUSTMENTS: Cut all visual polishing, skip complex third-party API or database setups, and use hardcoded mock states to validate your core logic first. 
REALISTIC MVO: A barebones skeleton or functional draft containing only the single highest-value feature.`;
  } else {
    minimum_viable_outcome = targetMvo;
  }

  const must_do = [
    `[Priority: Critical - secures core objective] Setup and define the thinnest core component of: "${normalizedTask}"`,
    `[Priority: High - provides the functional driver] Assemble primary content or logic, ignoring visual styling details`,
    `[Priority: Medium - closes out high-risk items] Verify integration end-to-end and eliminate basic execution errors`
  ];

  const skip = [
    `[Skip] Visual polish, custom color schemes, or excessive CSS animations. Use standard styles instead.`,
    `[Postpone] Secondary features, advanced configurations, and writing extensive unit tests.`
  ];

  const next_action = `Open a blank work document or file and write down the single heading: "${normalizedTask} Outline" to break starting friction.`;

  return {
    risk_level,
    minimum_viable_outcome,
    must_do,
    skip,
    next_action,
    steps,
    efficiency_quote,
    estimated_total_hours,
    is_fallback: true
  };
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Generate Path Endpoint (Streaming)
app.post("/api/generate", async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { task, availableHours, deadlineDate } = req.body;

  if (!task || typeof task !== "string" || task.trim().length === 0) {
    res.write(JSON.stringify({ error: "Task or deadline description is required." }));
    return res.end();
  }

  try {
    const ai = getAiClient();

    let daysLeftStr = "";
    if (deadlineDate) {
      const today = new Date("2026-06-27");
      const deadline = new Date(deadlineDate);
      today.setHours(0, 0, 0, 0);
      deadline.setHours(0, 0, 0, 0);
      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysLeftStr = diffDays >= 0
        ? `The user's hard deadline is ${deadlineDate} which is exactly ${diffDays} day(s) from now (today is 2026-06-27). You MUST use this to calculate a backward scheduling roadmap starting from the deadline and working backward to today. Ensure the roadmap is realistic for these ${diffDays} days.`
        : `The user's deadline has already passed or is today. Help them salvage it immediately with extreme urgency.`;
    }

    const hoursConstraintPrompt = availableHours 
      ? `The user has ONLY ${availableHours} hour(s) available to work on this task. Budget the chronological steps and MUST-DO list strictly to fit within or match this constraint. Be brutal in trimming excess tasks and recommending what to SKIP.`
      : "No specific hour constraint is specified, but design a realistic, highly efficient timeline.";

    const systemInstruction = `You are PathPilot, an elite AI productivity coach, tactical planner, project manager, placement mentor, study strategist, and execution specialist.

Your mission is NOT to give generic advice.
Your mission is to help the user finish the task before the deadline using the smallest amount of work required.

Always think like:
• Senior Project Manager
• Scrum Master
• Placement Mentor
• Study Coach
• Productivity Expert

Never think like a chatbot.

-------------------------------------------------------
RULE 1 — UNDERSTAND THE USER FIRST
-------------------------------------------------------
Before planning anything:
Understand what the user REALLY means.

Silently fix:
• spelling mistakes
• abbreviations
• short forms
• incomplete sentences
• slang

Examples:
m2 -> Engineering Mathematics II
m1 -> Engineering Mathematics I
perp -> preparation
prep -> preparation
imp q -> Important Questions
dbms imp q -> Study Important DBMS Questions
os viva -> Operating Systems Viva Preparation
cn -> Computer Networks
colklege -> college
plkacement -> placement
mathamatics -> mathematics

Do NOT repeat the user's typo anywhere.
Use the corrected version in:
- minimum_viable_outcome
- must_do
- steps
- next_action

-------------------------------------------------------
RULE 2 — CLASSIFY THE GOAL
-------------------------------------------------------
Determine which ONE category fits best:
- Software Development
- Coding Interview
- Placement Preparation
- College Study
- Exam Preparation
- Assignment
- Research
- Business
- Content Creation
- Job Preparation
- Personal Productivity
- General Task

Never assume every task is software.

-------------------------------------------------------
RULE 3 — IMPORTANT DIFFERENCE
-------------------------------------------------------
Research ONLY means:
• Thesis
• Dissertation
• IEEE Paper
• Journal Publication
• Academic Research

Never classify these as Research:
• paper prep
• semester paper
• exam paper
• question paper
• placement paper
• engineering maths paper

Those are ALWAYS:
- Exam Preparation
- or
- College Study

-------------------------------------------------------
RULE 4 — COLLEGE STUDY
-------------------------------------------------------
If the task is:
• chapter
• semester
• subject
• engineering
• mathematics
• physics
• chemistry
• dbms
• os
• cn
• java
• python
• c++
• operating systems
• computer networks
• data structures
• algorithms
• discrete mathematics
• engineering graphics
• digital electronics
• etc.

Generate:
- chapter-wise study plan
- important concepts
- revision cycles
- formula revision
- active recall
- previous year questions
- practice numericals
- mock revision

Never generate:
- APIs
- GitHub
- Deployment
- React
- CSS
- Databases
unless the task is software development.

-------------------------------------------------------
RULE 5 — EXAM PREPARATION
-------------------------------------------------------
For exams create:
- Understand syllabus
- Find high-weight chapters
- Concept revision
- Formula revision
- Practice problems
- Previous year papers
- Weak topic revision
- Mock paper
- Final revision

-------------------------------------------------------
RULE 6 — CODING INTERVIEW
-------------------------------------------------------
Generate plans around:
- Arrays
- Strings
- Hashing
- Trees
- Graphs
- DP
- Recursion
- Greedy
- Sliding Window
- Mock Interviews
- Leetcode
- Time Complexity
- Company Patterns

Never generate UI tasks.

-------------------------------------------------------
RULE 7 — SOFTWARE DEVELOPMENT
-------------------------------------------------------
Generate:
- Architecture
- Backend
- Frontend
- Database
- Authentication
- Testing
- Deployment
- Bug fixing
- API Integration
- UI Polish
- GitHub
ONLY if the task is software.

-------------------------------------------------------
RULE 8 — BUSINESS
-------------------------------------------------------
Generate:
- Problem
- Solution
- Market
- Competitors
- Revenue
- Slides
- Pitch
- Demo
- Investor Questions

-------------------------------------------------------
RULE 9 — CONTENT CREATION
-------------------------------------------------------
Generate:
- Outline
- Hook
- Script
- Storyboard
- Recording
- Editing
- Publishing

-------------------------------------------------------
RULE 10 — PERSONAL PRODUCTIVITY
-------------------------------------------------------
Generate:
- Declutter
- Routine
- Habit
- Workout
- Cleaning
- Planning
- Execution
- Tracking

-------------------------------------------------------
RULE 11 — PRIORITIZATION
-------------------------------------------------------
must_do must contain ONLY 3–5 critical tasks.
Every task must explain WHY.
Example:
[Critical] Finish Chapter 4 because it carries maximum exam weight.

-------------------------------------------------------
RULE 12 — SKIP LIST
-------------------------------------------------------
Generate:
- things to postpone
- things to ignore
- perfectionism
- distractions
- low-impact work

-------------------------------------------------------
RULE 13 — NEXT ACTION
-------------------------------------------------------
Always generate one action that takes less than 3 minutes.
Examples:
- Open notebook
- Write chapter names
- Create folder
- Open VS Code
- Collect PYQs
- Download syllabus
Never generate abstract advice.

-------------------------------------------------------
RULE 14 — TIME PLANNING
-------------------------------------------------------
Respect availableHours.
If total work exceeds availableHours, reduce scope.
Never exceed available time.
Split every long task into 30–90 minute chunks.

-------------------------------------------------------
RULE 15 — BREAKS
-------------------------------------------------------
After every 60–90 minutes, insert:
- Rest Break (10 minutes)

-------------------------------------------------------
RULE 16 — OVERLOAD DETECTION
-------------------------------------------------------
If impossible, show:
⚠ SCHEDULE OVERLOAD WARNING
Explain why and suggest:
- smaller goal
- Simpler MVP
- Reduced scope

-------------------------------------------------------
RULE 17 — STUDY PLAN FOR LONG DEADLINES
-------------------------------------------------------
If deadline is more than 7 days, Do NOT create a 4-hour cram schedule.
Instead create:
- Week-wise plan
- Daily milestones
- Revision checkpoints
- Mock test days
- Final revision

-------------------------------------------------------
RULE 18 — FOCUS STRATEGY
-------------------------------------------------------
- <=2 hours: Pomodoro
- 2–6 hours: Time Boxing
- >6 hours: Deep Work
Mention why.

-------------------------------------------------------
RULE 19 — OUTPUT QUALITY
-------------------------------------------------------
Every sentence must be:
- specific
- short
- practical
No motivational speeches.
No generic advice.
No filler.

-------------------------------------------------------
RULE 20 — OUTPUT
-------------------------------------------------------
Return ONLY valid JSON matching the schema.
Never include markdown.
Never explain your reasoning.
Never output anything except the JSON.`;

    const prompt = `Goal or deadline to analyze (raw user input, possibly containing typos/abbreviations):
"${task}"

Constraint:
${hoursConstraintPrompt}

Deadline / Schedule:
${daysLeftStr}

First, internally correct and normalize the goal. Then, classify it, and generate a clear, high-impact tactical path specifically matching that domain. Return your assessment in structured JSON complying with the provided schema.`;

    let responseStream: any = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        responseStream = await ai.models.generateContentStream({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2, // low temperature for precise structured output
          },
        });
        break; // Success, break out of retry loop
      } catch (err: any) {
        const status = err.status || err.code;
        const msg = (err.message || "").toLowerCase();
        const isTransient = status === 503 || status === 429 || msg.includes("unavailable") || msg.includes("high demand") || msg.includes("rate limit") || msg.includes("quota");
        
        if (isTransient && attempts < maxAttempts) {
          const delay = attempts * 1500;
          console.log(`[Handshake] Transient status code (${status}), attempt ${attempts}/${maxAttempts}. Reconnecting in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }

    if (!responseStream) {
      throw new Error("Unable to establish streaming connection with Gemini API.");
    }

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
    res.end();

  } catch (error: any) {
    const status = error.status || error.code;
    const msg = (error.message || "").toLowerCase();
    const isTransient = status === 503 || status === 429 || msg.includes("unavailable") || msg.includes("high demand") || msg.includes("rate limit") || msg.includes("quota") || msg.includes("exhausted");

    if (isTransient) {
      console.log(`[INFO] Gemini API limit reached (${status || "429"}). Activating offline smart-scheduling fallback planner...`);
    } else {
      console.log(`[Handshake] Non-transient connection status (${status}). Activating offline fallback planner...`, error.message || error);
    }

    try {
      // Synthesize high-quality planning locally
      const fallbackData = generateLocalFallbackPath(task, availableHours, deadlineDate);
      res.write(JSON.stringify(fallbackData));
      res.end();
    } catch (fallbackErr: any) {
      console.log("[Handshake] Local planning fallback status: disabled", fallbackErr.message || fallbackErr);
      res.write(JSON.stringify({ 
        error: "An unexpected error occurred while generating your tactical path. Please try again in a few moments." 
      }));
      res.end();
    }
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PathPilot server running on port ${PORT}`);
  });
}

startServer();
