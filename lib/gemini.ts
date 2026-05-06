import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Mode,
  TranscriptEntry,
  SummaryResult,
} from "./types";

export const NORMAL_PROMPT = `You are an expert content summarizer. Given the following YouTube video transcript, generate a structured summary with DYNAMIC SECTIONS.

IMPORTANT: Analyze the video first, then include ONLY sections that are applicable and have content. Return ONLY valid JSON.

ANALYSIS PHASE:
1. Determine video type: tutorial|course|talk|interview|other
2. For each possible section, assess:
   - Is this section relevant? (YES/NO)
   - Confidence level (0-100%)
   - Does it have substantial content? (YES/PARTIALLY/NO)
3. Only include sections with >70% confidence AND substantial content

POSSIBLE SECTIONS FOR NORMAL MODE:
- overview: High-level description (include if general context exists)
- summary: Comprehensive summary (include for most videos)
- timestamps: Timeline of key moments (include if video has clear progression)
- keyTakeaways: Actionable insights (include if lessons/tips present)

JSON STRUCTURE:
{
  "title": "inferred video title",
  "mode": "normal",
  "videoType": "tutorial|course|talk|interview|other",
  "sectionsIncluded": ["overview", "summary", "timestamps", "keyTakeaways"],
  "sectionsSkipped": ["sections not applicable"],
  "sectionMetadata": [
    {"sectionId": "overview", "present": true, "confidence": 95, "inferred": false}
  ],
  "content": {
    "overview": "2-3 sentence overview if applicable",
    "summary": "Comprehensive 2-3 paragraph summary",
    "timestamps": [
      { "time": "MM:SS", "topic": "Topic", "description": "Description" }
    ],
    "keyTakeaways": ["takeaway 1", "takeaway 2"]
  }
}

RULES:
- Include minimum 3 sections or indicate "insufficientContent": true
- Time format must be MM:SS
- 5-10 timestamps if included
- 3-6 key takeaways if included
- Write in clear, professional English

Transcript:
`;

export const SYSTEM_DESIGN_PROMPT = `You are an expert system design educator. Given the following YouTube video transcript, generate a structured summary with DYNAMIC SECTIONS.

ANALYSIS PHASE:
1. Confirm this is a system design video (architecture, scalability, distributed systems)
2. For each section, assess relevance, confidence (>70%), and content presence
3. Include ONLY sections that apply to this specific video

POSSIBLE SECTIONS (in logical order):
1. overview: High-level system description
2. summary: Comprehensive summary of design concepts
3. diagrams: Architecture diagrams (flowcharts ONLY, max 8 nodes, 3 diagrams max)
4. tradeoffs: Design decisions with pros/cons
5. timestamps: Timeline of design discussion
6. keyTakeaways: Key architectural lessons

JSON STRUCTURE:
{
  "title": "System name or topic",
  "mode": "system-design",
  "videoType": "system-design",
  "sectionsIncluded": ["overview", "summary", "diagrams", "tradeoffs", "keyTakeaways"],
  "sectionsSkipped": ["timestamps"],
  "sectionMetadata": [
    {"sectionId": "diagrams", "present": true, "confidence": 90, "inferred": false}
  ],
  "content": {
    "overview": "System overview",
    "summary": "Detailed summary",
    "diagrams": [
      {
        "title": "High-level Architecture",
        "mermaidCode": "graph TD\\n  A[Client] --> B[Load Balancer]\\n  B --> C[Server]",
        "description": "Architecture description"
      }
    ],
    "tradeoffs": [
      { "decision": "SQL vs NoSQL", "pros": ["pro1"], "cons": ["con1"] }
    ],
    "timestamps": [{"time": "MM:SS", "topic": "Topic", "description": "Desc"}],
    "keyTakeaways": ["lesson 1", "lesson 2"]
  }
}

DIAGRAM RULES:
- Use ONLY "graph TD" or "flowchart TD"
- Max 8 nodes per diagram
- Node IDs: single letters A-H
- Descriptive labels in quotes
- No special characters in labels
- 2-3 diagrams maximum

SECTION INCLUSION:
- Include minimum 3 sections
- diagrams: Only if architecture is discussed
- tradeoffs: Only if design decisions are explained
- timestamps: Optional, include if clear timeline

Transcript:
`;

export const PRO_PROMPT = `You are an expert content analyst. Transform a YouTube video transcript into a structured document with DYNAMIC SECTIONS.

ANALYSIS PHASE:
1. Determine video type and structure
2. Evaluate each possible section for relevance (>70% confidence) and content
3. Include ONLY sections with substantial, valuable content

POSSIBLE SECTIONS (logical order):
1. overview: What this video covers and who it's for
2. summary: Comprehensive 4-5 paragraph summary
3. tableOfContents: List of sections with timestamps
4. sections: 5-10 logical sections covering distinct topics
   - Each section: heading, startTime, endTime, sectionSummary, keyPoints
5. definitions: Technical terms explained (inline with sections where introduced)
6. callouts: Insights, warnings, tips (linked to specific sections)
7. qa: Questions the video answers
8. keyTakeaways: Actionable lessons

JSON STRUCTURE:
{
  "title": "Video title",
  "mode": "pro",
  "videoType": "tutorial|course|talk|interview|other",
  "sectionsIncluded": ["overview", "summary", "sections", "keyTakeaways"],
  "sectionsSkipped": ["definitions", "callouts", "qa"],
  "sectionMetadata": [
    {"sectionId": "sections", "present": true, "confidence": 95, "inferred": false}
  ],
  "content": {
    "overview": "What this video covers",
    "summary": "Comprehensive summary",
    "sections": [
      {
        "heading": "Section Title",
        "startTime": "MM:SS",
        "endTime": "MM:SS",
        "sectionSummary": "3-5 sentence summary. {critical}Important terms{/critical} marked.",
        "keyPoints": ["point 1", "point 2"]
      }
    ],
    "definitions": [{"term": "Term", "explanation": "Definition", "introducedIn": "Section Title"}],
    "callouts": [{"type": "insight", "title": "Title", "content": "Content"}],
    "qa": [{"question": "Q", "answer": "A"}],
    "keyTakeaways": ["takeaway 1", "takeaway 2"]
  }
}

CRITICAL RULES:
- Minimum 3 sections or set "insufficientContent": true
- sectionSummary REQUIRED for each section - NEVER use raw transcript
- Mark important keywords with {critical}term{/critical}
- Definitions only for terms actually explained in video
- Callouts only for notable points explicitly made
- Q&A only for questions actually addressed

Transcript:
`;

export const SYSTEM_DESIGN_PRO_PROMPT = `You are an expert system design architect. Transform a system design video into a comprehensive analysis with DYNAMIC SECTIONS.

PHASE 1 - VIDEO CLASSIFICATION:
{
  "videoType": "system-design|tutorial|talk|interview|other",
  "isSystemDesign": true|false,
  "confidence": 0-100
}

If isSystemDesign is false or confidence < 70%, set "insufficientContent": true with reason.

PHASE 2 - SECTION ANALYSIS (only if system design):
For each possible section, determine: relevance, confidence (>70%), content presence, inferred vs explicit

POSSIBLE SECTIONS (logical order):
1. overview: System context and purpose
2. summary: Comprehensive 4-5 paragraph technical summary
3. capacityEstimates: Back-of-envelope calculations (generate realistic numbers even if not stated)
4. dataModel: Entities, attributes, relationships
5. sections: Logical breakdown of design discussion (5-10 sections)
6. apiDesign: Key endpoints (only if APIs discussed - otherwise skip)
7. diagrams: Architecture visualizations (inline with sections, 3-5 diagrams, max 8 nodes)
8. tradeoffs: Design decisions with pros/cons (always include if SD video)
9. failureScenarios: Failure modes and mitigations (include if discussed)
10. nfrs: Non-functional requirements (include if discussed)
11. definitions: Technical terms
12. callouts: Insights, warnings, tips
13. qa: System design Q&A
14. keyTakeaways: Critical lessons

JSON STRUCTURE:
{
  "title": "System name",
  "mode": "system-design-pro",
  "videoType": "system-design",
  "isSystemDesign": true,
  "sectionsIncluded": ["overview", "summary", "capacityEstimates", "dataModel", "sections", ...],
  "sectionsSkipped": ["apiDesign", "failureScenarios", ...],
  "sectionMetadata": [
    {"sectionId": "capacityEstimates", "present": true, "confidence": 85, "inferred": true, "note": "Generated typical values for this system type"}
  ],
  "content": {
    "overview": "System context",
    "summary": "Comprehensive summary with {critical}key terms{/critical} marked",
    "capacityEstimates": [
      {"metric": "DAU", "value": "10 million", "explanation": "Typical for consumer app"}
    ],
    "dataModel": [
      {"entity": "User", "attributes": ["id", "name", "email"], "relationships": ["Posts (1:N)"]}
    ],
    "sections": [
      {
        "heading": "High-level Design",
        "startTime": "MM:SS",
        "endTime": "MM:SS",
        "sectionSummary": "Summary with {critical}important concepts{/critical} marked",
        "keyPoints": ["point 1", "point 2"]
      }
    ],
    "apiDesign": [
      {"endpoint": "/api/users", "method": "GET", "description": "List users", "requestParams": ["limit"], "responseParams": ["users"]}
    ],
    "diagrams": [
      {
        "title": "Architecture",
        "mermaidCode": "graph TD\\n  A --> B",
        "description": "Description",
        "diagramType": "flowchart|sequence|class|er|state|mindmap",
        "relatedSection": "Section Title"
      }
    ],
    "tradeoffs": [{"decision": "Choice", "pros": ["pro"], "cons": ["con"]}],
    "failureScenarios": [{"scenario": "What fails", "impact": "Effect", "mitigation": "Solution"}],
    "nfrs": [{"category": "scalability", "requirements": ["99.9% uptime"]}],
    "definitions": [{"term": "Term", "explanation": "Definition", "introducedIn": "Section Title"}],
    "callouts": [{"type": "insight", "title": "Title", "content": "Content"}],
    "qa": [{"question": "Q", "answer": "A"}],
    "keyTakeaways": ["critical lesson 1", "critical lesson 2"]
  }
}

CRITICAL RULES:
- Minimum 4 sections or set "insufficientContent": true
- capacityEstimates: ALWAYS include with realistic numbers (mark as inferred if not explicit)
- dataModel: ALWAYS include for system design
- apiDesign: Only if video discusses APIs, otherwise set to null
- diagrams: Max 8 nodes, multiple diagram types allowed, link to sections
- tradeoffs: Always include for SD videos (minimum 3)
- failureScenarios: Include only if discussed (don't invent)
- nfrs: Include only if discussed
- Use {critical}term{/critical} for important keywords
- Add [REF:section-heading] for cross-references

Transcript:
`;

export const TECHNICAL_COURSE_PROMPT = `You are an expert technical educator. Transform a programming/technology course video into a structured learning document with DYNAMIC SECTIONS.

ANALYSIS PHASE:
1. Classify: Is this a technical course/tutorial? (confidence 0-100)
2. Identify: Target audience, topics covered, structure
3. Select: Only sections with >70% confidence and substantial content

POSSIBLE SECTIONS:
1. overview: Course description and learning outcomes
2. targetAudience: Beginner/intermediate/advanced (only if explicitly stated)
3. lessons: Chronological lessons/modules (5-10 lessons)
4. keyConcepts: Technical concepts introduced (with lesson references)
5. toolsMentioned: Technologies, frameworks, tools used
6. keyTakeaways: What the learner should remember

JSON STRUCTURE:
{
  "title": "Course title",
  "mode": "technical-course",
  "videoType": "course|tutorial",
  "sectionsIncluded": ["overview", "lessons", "keyTakeaways"],
  "sectionsSkipped": ["targetAudience", "toolsMentioned"],
  "sectionMetadata": [
    {"sectionId": "lessons", "present": true, "confidence": 98, "inferred": false}
  ],
  "content": {
    "overview": "What this course teaches",
    "targetAudience": "beginner|intermediate|advanced",
    "lessons": [
      {
        "title": "Lesson 1: Introduction",
        "startTime": "MM:SS",
        "endTime": "MM:SS",
        "concepts": ["concept 1", "concept 2"],
        "keyPoints": ["point 1", "point 2"]
      }
    ],
    "keyConcepts": [
      {"term": "Concept", "definition": "Explanation", "introducedIn": "Lesson 1: Introduction"}
    ],
    "toolsMentioned": ["Tool 1", "Tool 2"],
    "keyTakeaways": ["learning 1", "learning 2"]
  }
}

CRITICAL RULES:
- Minimum 3 sections or set "insufficientContent": true
- Lessons must be in chronological order (video progression)
- targetAudience: Only if explicitly mentioned in video
- toolsMentioned: Only tools actually demonstrated/discussed
- keyConcepts: Link each to the lesson where introduced
- Use {critical}term{/critical} for important technical terms

Transcript:
`;

export const TECHNICAL_COURSE_PRO_PROMPT = `You are an expert technical educator and curriculum designer. Transform a course video into a comprehensive learning resource with DYNAMIC SECTIONS.

PHASE 1 - VIDEO CLASSIFICATION:
Classify as course|tutorial and assess confidence. If not technical content, set "insufficientContent": true.

PHASE 2 - SECTION ANALYSIS:
For each possible section: assess relevance (>70% confidence), content presence, inferred vs explicit.

POSSIBLE SECTIONS (logical + chronological mix):
1. overview: Course description and outcomes
2. targetAudience: Level (only if explicitly stated)
3. prerequisites: Skills needed (only if explicitly mentioned)
4. lessons: Chronological lessons (5-10, core structure)
   - For each lesson: codeExamples, keyConcepts (inline)
5. keyConcepts: Glossary of all concepts (with lesson references)
6. implementationSteps: Project/course steps (if applicable)
7. commonPitfalls: Mistakes to avoid (inline with lessons or separate)
8. toolsMentioned: Complete list of technologies
9. codeExamples: Extracted code from video (organized by lesson)
10. exerciseSuggestions: Practice exercises (AI-generated based on content)
11. bestPractices: Industry standards mentioned
12. resources: Links, docs mentioned (only if explicit)
13. keyTakeaways: Critical learnings

JSON STRUCTURE:
{
  "title": "Course title",
  "mode": "technical-course-pro",
  "videoType": "course|tutorial",
  "sectionsIncluded": ["overview", "lessons", "keyConcepts", "exerciseSuggestions", "keyTakeaways"],
  "sectionsSkipped": ["prerequisites", "implementationSteps", "resources"],
  "sectionMetadata": [
    {"sectionId": "codeExamples", "present": true, "confidence": 90, "inferred": false}
  ],
  "content": {
    "overview": "Course description",
    "targetAudience": "beginner|intermediate|advanced",
    "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
    "lessons": [
      {
        "title": "Lesson 1: Setup",
        "startTime": "00:00",
        "endTime": "05:30",
        "concepts": ["Environment setup", "Dependencies"],
        "keyPoints": ["Install Node.js", "Initialize project"],
        "codeExamples": [
          {
            "language": "bash",
            "code": "npm init -y",
            "explanation": "Initialize Node.js project",
            "timestamp": "02:15"
          }
        ],
        "pitfalls": ["Don't forget to save dependencies"],
        "bestPractices": ["Use latest LTS version"],
        "exerciseSuggestions": ["Set up your own project"]
      }
    ],
    "keyConcepts": [
      {"term": "npm", "definition": "Node package manager", "introducedIn": "Lesson 1: Setup"}
    ],
    "implementationSteps": ["Step 1", "Step 2"],
    "commonPitfalls": ["Mistake 1", "Mistake 2"],
    "toolsMentioned": ["Node.js", "npm", "VS Code"],
    "exerciseSuggestions": ["Exercise 1", "Exercise 2"],
    "bestPractices": ["Practice 1", "Practice 2"],
    "resources": ["https://nodejs.org", "https://npmjs.com"],
    "keyTakeaways": ["Learning 1", "Learning 2"]
  }
}

CRITICAL RULES:
- Minimum 4 sections or set "insufficientContent": true
- Lessons: Chronological order, 5-10 lessons
- prerequisites: ONLY if explicitly stated in video (not inferred)
- codeExamples: Extract actual code shown/discussed
- exerciseSuggestions: Generate 2-3 per lesson or 5-10 total
- resources: ONLY URLs/links actually mentioned
- Inline content (pitfalls, bestPractices, exercises) within lessons
- Use {critical}term{/critical} for important keywords
- Add [REF:lesson-title] for cross-references between lessons

Transcript:
`;

export function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((entry) => {
      const minutes = Math.floor(entry.offset / 60000);
      const seconds = Math.floor((entry.offset % 60000) / 1000);
      const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      return `[${timeStr}] ${entry.text}`;
    })
    .join("\n");
}

export function trimTranscript(transcript: TranscriptEntry[], maxChars: number): TranscriptEntry[] {
  const totalChars = transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);
  if (totalChars <= maxChars) return transcript;

  // Keep first ~60% and last ~40% to preserve beginning context and conclusion
  const firstChunk = Math.floor(maxChars * 0.6);
  const lastChunk = maxChars - firstChunk;

  const result: TranscriptEntry[] = [];
  let charCount = 0;

  // First chunk: from the start
  for (const entry of transcript) {
    const entryLen = (entry.text?.length || 0) + 8; // +8 for timestamp overhead
    if (charCount + entryLen > firstChunk) break;
    result.push(entry);
    charCount += entryLen;
  }

  // Last chunk: from the end
  const tailEntries: TranscriptEntry[] = [];
  let tailCount = 0;
  for (let i = transcript.length - 1; i >= 0; i--) {
    const entryLen = (transcript[i].text?.length || 0) + 8;
    if (tailCount + entryLen > lastChunk) break;
    tailEntries.unshift(transcript[i]);
    tailCount += entryLen;
  }

  // Add separator if we skipped middle
  if (result.length + tailEntries.length < transcript.length) {
    const lastOffset = result[result.length - 1]?.offset || 0;
    const firstTailOffset = tailEntries[0]?.offset || lastOffset;
    const gap = Math.round((firstTailOffset - lastOffset) / 60000);
    result.push({
      text: `[...${gap} minutes of content omitted...]`,
      offset: lastOffset + Math.round((firstTailOffset - lastOffset) / 2),
      duration: firstTailOffset - lastOffset,
    });
    result.push(...tailEntries);
  } else {
    result.push(...tailEntries);
  }

  return result;
}

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate") || msg.includes("resource_exhausted") || msg.includes("too many requests")) {
      return true;
    }
  }
  return false;
}

function flattenContent(parsed: Record<string, unknown>): void {
  const content = parsed.content;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const contentObj = content as Record<string, unknown>;
    for (const key of Object.keys(contentObj)) {
      if (!(key in parsed) || parsed[key] === undefined || parsed[key] === null) {
        parsed[key] = contentObj[key];
      }
    }
    delete parsed.content;
  }
}

function normalizeBaseSummary(parsed: Record<string, unknown>): void {
  flattenContent(parsed);
  if (!Array.isArray(parsed.sectionsIncluded)) parsed.sectionsIncluded = [];
  if (!Array.isArray(parsed.sectionsSkipped)) parsed.sectionsSkipped = [];
  if (!Array.isArray(parsed.sectionMetadata)) parsed.sectionMetadata = [];
  if (typeof parsed.videoType !== "string") parsed.videoType = "other";
}

function normalizeNormalSummary(parsed: Record<string, unknown>): void {
  normalizeBaseSummary(parsed);
  parsed.mode = "normal";
}

function normalizeSystemDesignSummary(parsed: Record<string, unknown>): void {
  normalizeBaseSummary(parsed);
  parsed.mode = "system-design";
  
  if (!Array.isArray(parsed.diagrams)) parsed.diagrams = [];
  if (!Array.isArray(parsed.tradeoffs)) parsed.tradeoffs = [];
  
  parsed.diagrams = (parsed.diagrams as unknown[]).map(
    (d: unknown) => ({
      title: (d as Record<string, string>).title || "Untitled",
      mermaidCode: ((d as Record<string, string>).mermaidCode || "").replace(/\\n/g, "\n"),
      description: (d as Record<string, string>).description || "",
    })
  );
}

function normalizeProSummary(parsed: Record<string, unknown>): void {
  normalizeBaseSummary(parsed);
  parsed.mode = "pro";
  
  if (!Array.isArray(parsed.sections)) parsed.sections = [];
  if (!Array.isArray(parsed.definitions)) parsed.definitions = [];
  if (!Array.isArray(parsed.callouts)) parsed.callouts = [];
  if (!Array.isArray(parsed.qa)) parsed.qa = [];
  
  parsed.sections = (parsed.sections as unknown[]).map(
    (s: unknown) => ({
      heading: (s as Record<string, string>).heading || "Untitled Section",
      startTime: (s as Record<string, string>).startTime || "00:00",
      endTime: (s as Record<string, string>).endTime || "00:00",
      keyPoints: Array.isArray((s as Record<string, unknown>).keyPoints) 
        ? (s as Record<string, unknown[]>).keyPoints.map(String)
        : [],
      sectionSummary: (s as Record<string, string>).sectionSummary || "",
    })
  );
}

function normalizeSystemDesignProSummary(parsed: Record<string, unknown>): void {
  normalizeProSummary(parsed);
  parsed.mode = "system-design-pro";
  
  if (typeof parsed.isSystemDesign !== "boolean") parsed.isSystemDesign = true;
  if (!Array.isArray(parsed.capacityEstimates)) parsed.capacityEstimates = [];
  if (!Array.isArray(parsed.dataModel)) parsed.dataModel = [];
  if (!Array.isArray(parsed.apiDesign)) parsed.apiDesign = [];
  if (!Array.isArray(parsed.failureScenarios)) parsed.failureScenarios = [];
  if (!Array.isArray(parsed.nfrs)) parsed.nfrs = [];
  if (!Array.isArray(parsed.diagrams)) parsed.diagrams = [];
  if (!Array.isArray(parsed.tradeoffs)) parsed.tradeoffs = [];
  
  parsed.diagrams = (parsed.diagrams as unknown[]).map(
    (d: unknown) => ({
      title: (d as Record<string, string>).title || "Untitled",
      mermaidCode: ((d as Record<string, string>).mermaidCode || "").replace(/\\n/g, "\n"),
      description: (d as Record<string, string>).description || "",
      diagramType: (d as Record<string, string>).diagramType || "flowchart",
      relatedSection: (d as Record<string, string>).relatedSection,
    })
  );
}

function normalizeTechnicalCourseSummary(parsed: Record<string, unknown>): void {
  normalizeBaseSummary(parsed);
  parsed.mode = "technical-course";
  
  if (!Array.isArray(parsed.lessons)) parsed.lessons = [];
  if (!Array.isArray(parsed.keyConcepts)) parsed.keyConcepts = [];
  if (!Array.isArray(parsed.toolsMentioned)) parsed.toolsMentioned = [];
  
  parsed.lessons = (parsed.lessons as unknown[]).map(
    (l: unknown) => ({
      title: (l as Record<string, string>).title || "Untitled Lesson",
      startTime: (l as Record<string, string>).startTime || "00:00",
      endTime: (l as Record<string, string>).endTime || "00:00",
      concepts: Array.isArray((l as Record<string, unknown>).concepts)
        ? (l as Record<string, unknown[]>).concepts.map(String)
        : [],
      keyPoints: Array.isArray((l as Record<string, unknown>).keyPoints)
        ? (l as Record<string, unknown[]>).keyPoints.map(String)
        : [],
    })
  );
}

function normalizeTechnicalCourseProSummary(parsed: Record<string, unknown>): void {
  normalizeTechnicalCourseSummary(parsed);
  parsed.mode = "technical-course-pro";
  
  if (!Array.isArray(parsed.prerequisites)) parsed.prerequisites = [];
  if (!Array.isArray(parsed.implementationSteps)) parsed.implementationSteps = [];
  if (!Array.isArray(parsed.commonPitfalls)) parsed.commonPitfalls = [];
  if (!Array.isArray(parsed.exerciseSuggestions)) parsed.exerciseSuggestions = [];
  if (!Array.isArray(parsed.bestPractices)) parsed.bestPractices = [];
  if (!Array.isArray(parsed.resources)) parsed.resources = [];
  
  // Add code examples to lessons if present
  parsed.lessons = (parsed.lessons as unknown[]).map(
    (l: unknown) => ({
      ...(l as Record<string, unknown>),
      codeExamples: Array.isArray((l as Record<string, unknown>).codeExamples)
        ? (l as Record<string, unknown[]>).codeExamples
        : [],
      pitfalls: Array.isArray((l as Record<string, unknown>).pitfalls)
        ? (l as Record<string, unknown[]>).pitfalls.map(String)
        : [],
      bestPractices: Array.isArray((l as Record<string, unknown>).bestPractices)
        ? (l as Record<string, unknown[]>).bestPractices.map(String)
        : [],
      exerciseSuggestions: Array.isArray((l as Record<string, unknown>).exerciseSuggestions)
        ? (l as Record<string, unknown[]>).exerciseSuggestions.map(String)
        : [],
    })
  );
}

export async function summarizeTranscript(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  let prompt: string;
  switch (mode) {
    case "normal":
      prompt = NORMAL_PROMPT;
      break;
    case "system-design":
      prompt = SYSTEM_DESIGN_PROMPT;
      break;
    case "pro":
      prompt = PRO_PROMPT;
      break;
    case "system-design-pro":
      prompt = SYSTEM_DESIGN_PRO_PROMPT;
      break;
    case "technical-course":
      prompt = TECHNICAL_COURSE_PROMPT;
      break;
    case "technical-course-pro":
      prompt = TECHNICAL_COURSE_PRO_PROMPT;
      break;
    default:
      prompt = NORMAL_PROMPT;
  }

  // Truncate very long transcripts to stay within token limits and avoid timeouts
  // ~4 chars per token, Gemini 2.5 Flash has 1M context but output is limited
  // Cap at 120K chars (~30K tokens input) which covers ~2hr videos comfortably
  const MAX_TRANSCRIPT_CHARS = 120000;
  const formattedTranscript = formatTranscript(
    transcript.length * 30 > MAX_TRANSCRIPT_CHARS
      ? trimTranscript(transcript, MAX_TRANSCRIPT_CHARS)
      : transcript
  );

  const fullPrompt = `${prompt}
Video Title: ${title}
Video ID: ${videoId}

${formattedTranscript}`;

  const maxRetries = 1;
  const baseDelay = 1500;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      const cleanedText = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const parsed = JSON.parse(cleanedText);

      // Check for insufficient content
      if (parsed.insufficientContent) {
        const reason = parsed.reason || "";
        const modeLabel = mode === "system-design-pro" ? "System Design Pro"
          : mode === "system-design" ? "System Design"
            : mode === "technical-course-pro" ? "Technical Course Pro"
              : mode === "technical-course" ? "Technical Course"
                : mode === "pro" ? "Pro" : mode;
        const suggestion = mode === "system-design-pro" || mode === "system-design"
          ? "Try Normal or Pro mode instead — they work with any video type."
          : mode === "technical-course-pro" || mode === "technical-course"
            ? "Try Normal or Pro mode instead — they work with any video type."
            : "";
        throw new Error(
          `INSUFFICIENT_CONTENT:This video doesn't have enough content for ${modeLabel} mode. ${reason}${suggestion ? " " + suggestion : ""}`.trim()
        );
      }

      const sectionsIncluded = parsed.sectionsIncluded || [];
      if (sectionsIncluded.length < 3 && mode !== "normal") {
        const modeLabel = mode === "system-design-pro" ? "System Design Pro"
          : mode === "system-design" ? "System Design"
            : mode === "technical-course-pro" ? "Technical Course Pro"
              : mode === "technical-course" ? "Technical Course"
                : mode === "pro" ? "Pro" : mode;
        const suggestion = mode === "system-design-pro" || mode === "system-design"
          ? "Try Normal or Pro mode instead — they work with any video type."
          : mode === "technical-course-pro" || mode === "technical-course"
            ? "Try Normal or Pro mode instead — they work with any video type."
            : "";
        throw new Error(
          `INSUFFICIENT_CONTENT:Only ${sectionsIncluded.length} sections could be identified for ${modeLabel} mode. ${suggestion}`.trim()
        );
      }

      // Normalize based on mode
      switch (mode) {
        case "normal":
          normalizeNormalSummary(parsed);
          break;
        case "system-design":
          normalizeSystemDesignSummary(parsed);
          break;
        case "pro":
          normalizeProSummary(parsed);
          break;
        case "system-design-pro":
          normalizeSystemDesignProSummary(parsed);
          
          // Check if it's actually system design
          if (parsed.isSystemDesign === false) {
            throw new Error(
              `SD_PRO_MISMATCH: This video appears to be a ${parsed.videoType || "non-system-design"} video, not a system design video.`
            );
          }
          break;
        case "technical-course":
          normalizeTechnicalCourseSummary(parsed);
          break;
        case "technical-course-pro":
          normalizeTechnicalCourseProSummary(parsed);
          
          // Check if it's actually a course/tutorial
          const videoType = parsed.videoType || "";
          if (videoType !== "course" && videoType !== "tutorial") {
            throw new Error(
              `TC_PRO_MISMATCH: This video appears to be a ${videoType || "non-course"} video, not a technical course.`
            );
          }
          break;
      }

      return parsed as SummaryResult;
    } catch (error) {
      lastError = error as Error;

      if (isRateLimitError(error)) {
        throw new Error(
          "Gemini AI rate limit reached. Free tier allows 15 requests per minute. Please wait 60 seconds and try again."
        );
      }

      // Don't retry on content mismatch errors
      if (lastError.message.includes("SD_PRO_MISMATCH") || lastError.message.includes("TC_PRO_MISMATCH")) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to generate summary after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}
