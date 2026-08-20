/**
 * Structured User Profile & Long-Term Context for Harsh Shrivastava
 * 
 * DESIGN PRINCIPLES:
 * 1. The profile is SILENT BACKGROUND CONTEXT, never a response script.
 * 2. Information is retrieved only when strictly relevant to the user's intent or conversation context.
 * 3. General questions (math, standard code explanations) inject ZERO profile context.
 * 4. Strict privacy: Phone numbers are never stored and never exposed.
 * 5. Context-First Resolution: Pronoun and elliptical follow-ups ("his name", "what did he build", "where does he work")
 *    are resolved using immediately preceding conversational context.
 */

export const HARSH_PROFILE = {
  identity: {
    name: "Harsh Shrivastava",
    role: "Software Engineer Intern & Full-Stack Developer",
  },
  education: {
    degree: "B.Tech in Computer Science and Engineering",
    specialization: "SAP Specialization",
    institution: "Parul Institute of Engineering & Technology, Parul University",
    location: "Vadodara, Gujarat, India",
    graduation: "Expected June 2028",
    cgpa: "7.58",
  },
  employment: {
    company: "CrackTier Pvt. Ltd.",
    role: "Software Engineer Intern",
    location: "Vadodara, Gujarat, India",
    duration: "May 2026 – Present",
    focus: "Full-stack development using React, JavaScript, Firebase, and REST APIs, along with Git workflows, code reviews, and structured debugging.",
  },
  projects: [
    {
      id: "devwatchai",
      name: "DevWatchAI",
      title: "AI-Powered Developer Collaboration Platform",
      tech: ["Next.js", "TypeScript", "Express", "Firebase", "MongoDB Atlas"],
      description: "Full-stack AI developer platform with Google OAuth, JWT authentication, automated code reviews, collaborative workspaces, cloud IDE, and real-time team chat.",
    },
    {
      id: "aira",
      name: "AIRA",
      title: "AI Voice Assistant",
      tech: ["React", "Vite", "Tailwind CSS", "Vercel serverless", "Speech Recognition", "Speech Synthesis", "Groq AI"],
      description: "Voice-first AI assistant with real-time conversational interaction, voice interruption handling, contextual memory, voice commands, proactive assistance, and server-side memory relevance retrieval.",
    },
    {
      id: "propvera",
      name: "PropVera",
      title: "Real Estate Operating System",
      tech: ["React", "Vite", "Tailwind CSS", "Firebase"],
      description: "B2B SaaS platform for property management with role-based access control, CRUD operations, and real-time database synchronization.",
    },
    {
      id: "sahara",
      name: "Sahara",
      title: "Full-Stack Disaster & Mental Health Platform",
      tech: ["HTML", "CSS", "TypeScript", "Firebase"],
      description: "Real-time platform connecting NGOs and users for disaster response and instant support coordination.",
    },
    {
      id: "flowspace",
      name: "FlowSpace",
      title: "Smart Workspace and Parking Management System",
      tech: ["React", "Firebase"],
      description: "Full-stack booking system with live availability tracking, Google OAuth, admin approvals, and automatic booking expiry.",
    },
    {
      id: "splitchain",
      name: "SplitChain",
      title: "Web3 Expense Splitter",
      tech: ["HTML", "CSS", "TypeScript", "Coinbase Wallet"],
      description: "Blockchain expense management application supporting secure USDC transactions and group expense tracking.",
    },
  ],
  skills: {
    languages: ["JavaScript", "TypeScript", "Python", "Java", "C++", "HTML/CSS", "SQL"],
    frameworks: ["React.js", "Next.js", "Express.js", "Node.js", "Tailwind CSS"],
    databases: ["MongoDB", "PostgreSQL", "Firebase Firestore", "Appwrite"],
    tools: ["Git", "GitHub", "Vercel", "Postman", "Docker", "VS Code", "Vite"],
    core: ["Data Structures & Algorithms", "Object-Oriented Programming (OOP)", "Database Management Systems (DBMS)", "REST API Design", "System Design"],
  },
  certifications: [
    "Postman API Fundamentals Student Expert (Postman)",
    "Python (IBM)",
    "Oracle Cloud Infrastructure Certified Generative AI Professional (Oracle)",
    "Gemini Certified Student (Google)",
  ],
  privacy: {
    phone: "DO NOT STORE — REJECT ACCESS WITH: 'I don't share private contact information.'",
    email: "PRIVATE — Never volunteer in general responses.",
  },
};

/**
 * Intelligent Category Profile Memory Selector
 * 
 * Inspects user input AND recent conversational context to return ONLY the minimal,
 * relevant context required. Returns NULL for general questions (math, syntax, unrelated code).
 * 
 * @param {string} queryText - Current user utterance
 * @param {Array} messageHistory - Recent conversation history
 * @returns {Object|null} { category, content } or null
 */
export function getCategoryProfileMemory(queryText, messageHistory = []) {
  if (!queryText || typeof queryText !== "string") return null;

  const q = queryText.toLowerCase().trim();

  // Extract recent context window for pronoun and reference resolution
  const recentHistory = (messageHistory || []).slice(-4);
  const recentHistoryText = recentHistory.map((m) => m.content || "").join(" ").toLowerCase();

  const isDiscussingDeveloper = /\b(developer|creator|built me|created me|made me|author|maker|built you|created you|made you|who made|who built)\b/i.test(recentHistoryText);
  const isDiscussingHarsh = isDiscussingDeveloper || /\b(harsh|shrivastava)\b/i.test(recentHistoryText);

  // 1. Phone number inquiries -> Strict privacy boundary
  if (/\b(phone|mobile|call\s*me|cell\s*number|contact\s*number|phone\s*number)\b/i.test(q)) {
    return {
      category: "privacy_contact",
      content: "PRIVACY BOUNDARY: Do NOT disclose or reveal any phone number. Respond strictly and naturally with: 'I don't share private contact information.'"
    };
  }

  // 2. Developer / Creator Identity & Name Inquiries (Direct or Follow-up like "his name", "who built you", "tell me about your developer")
  if (
    /\b(who\s+(built|made|created|developed)\s+you|who\s+is\s+your\s+(creator|developer|maker)|tell\s+me\s+about\s+your\s+(creator|developer|maker)|your\s+developer|your\s+creator)\b/i.test(q) ||
    ((isDiscussingDeveloper || isDiscussingHarsh) && /\b(his\s+name|her\s+name|what('s|\s+is)\s+his\s+name|who\s+is\s+he|what\s+is\s+the\s+name|name\?|who\?)\b/i.test(q))
  ) {
    return {
      category: "creator_identity",
      content: `Creator Identity: AIRA was built and developed by Harsh Shrivastava as a voice-first AI assistant. (Answer directly and naturally with his name: Harsh Shrivastava).`
    };
  }

  // 3. User Name / Identity questions ("What is my name?", "Who am I?", "What's my name?")
  if (/\b(what('s|\s+is)\s+my\s+name|who\s+am\s+i|do\s+you\s+know\s+my\s+name|my\s+name)\b/i.test(q)) {
    return {
      category: "identity",
      content: `User's Name: ${HARSH_PROFILE.identity.name}. Answer naturally in 1 short sentence.`
    };
  }

  // 4. Education queries ("Where do I study?", "Where does he study?", "What is my CGPA?", "What am I studying?")
  if (
    /\b(where\s+do\s+i\s+(study|go\s+to\s+college|go\s+to\s+school|attend)|what\s+(university|college|school)\s+do\s+i\s+attend|what\s+is\s+my\s+college)\b/i.test(q) ||
    ((isDiscussingHarsh || isDiscussingDeveloper) && /\b(where\s+does\s+he\s+(study|attend|go)|his\s+college|his\s+university)\b/i.test(q))
  ) {
    return {
      category: "education_location",
      content: `Subject: Harsh Shrivastava (Education Location). Institution: ${HARSH_PROFILE.education.institution} in ${HARSH_PROFILE.education.location}. (Answer directly with the institution name).`
    };
  }

  if (
    /\b(what\s+am\s+i\s+studying|what\s+is\s+my\s+(degree|major|branch|field|specialization)|what\s+do\s+i\s+study)\b/i.test(q) ||
    ((isDiscussingHarsh || isDiscussingDeveloper) && /\b(what\s+is\s+he\s+studying|what\s+does\s+he\s+study|his\s+degree|his\s+major)\b/i.test(q))
  ) {
    return {
      category: "education_degree",
      content: `Subject: Harsh Shrivastava (Degree/Major). Program: ${HARSH_PROFILE.education.degree} with an ${HARSH_PROFILE.education.specialization} at ${HARSH_PROFILE.education.institution}.`
    };
  }

  if (/\b(cgpa|gpa|grades?|marks?)\b/i.test(q)) {
    return {
      category: "education_cgpa",
      content: `Subject: Harsh Shrivastava (Academic CGPA). CGPA: ${HARSH_PROFILE.education.cgpa} in ${HARSH_PROFILE.education.degree}. (Answer only the CGPA).`
    };
  }

  if (/\b(study|studying|college|university|education|degree|b\.?tech|parul)\b/i.test(q) && /\b(i|my|me|harsh|he|his)\b/i.test(q)) {
    return {
      category: "education",
      content: `Subject: Harsh Shrivastava (Education). Program: ${HARSH_PROFILE.education.degree} (${HARSH_PROFILE.education.specialization}) at ${HARSH_PROFILE.education.institution}, ${HARSH_PROFILE.education.location}. Expected graduation: ${HARSH_PROFILE.education.graduation}.`
    };
  }

  // 5. Employment / Internship / Role ("Where do I work?", "Where does he work?", "What is his role?")
  if (
    /\b(where\s+do\s+i\s+work|what\s+is\s+my\s+(job|role|current\s+role|internship|company)|where\s+am\s+i\s+working|my\s+work|my\s+job)\b/i.test(q) ||
    ((isDiscussingHarsh || isDiscussingDeveloper) && /\b(where\s+does\s+he\s+work|what\s+is\s+his\s+(job|role|internship|company)|where\s+is\s+he\s+working|his\s+work|his\s+job)\b/i.test(q)) ||
    (/\b(work|job|internship|role|company|cracktier)\b/i.test(q) && /\b(harsh|i|my|me|he|his)\b/i.test(q))
  ) {
    return {
      category: "employment",
      content: `Subject: Harsh Shrivastava (Employment/Work). Company: ${HARSH_PROFILE.employment.company} (${HARSH_PROFILE.employment.location}). Role: ${HARSH_PROFILE.employment.role}. Focus: ${HARSH_PROFILE.employment.focus}. (Answer where they work: CrackTier Pvt. Ltd.).`
    };
  }

  // 6. Improving AIRA vs Specific Project Inquiries
  if (/\b(improve\s+aira|make\s+aira\s+better|upgrade\s+aira|features?\s+for\s+aira|help\s+me\s+improve\s+aira|how\s+can\s+i\s+improve\s+aira)\b/i.test(q)) {
    return {
      category: "aira_improvements",
      content: `AIRA Architecture & Next Gains: AIRA is built with React, Vite, Tailwind CSS, Vercel serverless, SpeechRecognition/Synthesis, and Groq AI. Key high-impact technical enhancements: 1) Hardening the real-time voice loop and interruption handling; 2) Sub-millisecond latency and long conversation fluidity; 3) Useful external actions (like email drafting/sending); 4) Stronger multi-turn contextual memory across sessions. Give concrete, technical suggestions rather than generic chatbot advice.`
    };
  }

  if (/\b(devwatch|devwatchai)\b/i.test(q)) {
    const p = HARSH_PROFILE.projects.find((x) => x.id === "devwatchai");
    return { category: "project_devwatchai", content: `DevWatchAI (${p.title}): ${p.description}. Tech: ${p.tech.join(", ")}.` };
  }

  if (/\b(aira)\b/i.test(q) && !/\b(improve|better|upgrade)\b/i.test(q)) {
    const p = HARSH_PROFILE.projects.find((x) => x.id === "aira");
    return { category: "project_aira", content: `AIRA (${p.title}): ${p.description}. Tech: ${p.tech.join(", ")}.` };
  }

  if (/\b(propvera)\b/i.test(q)) {
    const p = HARSH_PROFILE.projects.find((x) => x.id === "propvera");
    return { category: "project_propvera", content: `PropVera (${p.title}): ${p.description}. Tech: ${p.tech.join(", ")}.` };
  }

  if (/\b(sahara)\b/i.test(q)) {
    const p = HARSH_PROFILE.projects.find((x) => x.id === "sahara");
    return { category: "project_sahara", content: `Sahara (${p.title}): ${p.description}. Tech: ${p.tech.join(", ")}.` };
  }

  if (/\b(flowspace)\b/i.test(q)) {
    const p = HARSH_PROFILE.projects.find((x) => x.id === "flowspace");
    return { category: "project_flowspace", content: `FlowSpace (${p.title}): ${p.description}. Tech: ${p.tech.join(", ")}.` };
  }

  if (/\b(splitchain)\b/i.test(q)) {
    const p = HARSH_PROFILE.projects.find((x) => x.id === "splitchain");
    return { category: "project_splitchain", content: `SplitChain (${p.title}): ${p.description}. Tech: ${p.tech.join(", ")}.` };
  }

  // 7. Projects general overview ("What projects have I worked on?", "What did he build?", "What projects did he build?")
  if (
    /\b(what\s+projects\s+(have\s+i|did\s+i|have\s+been)|my\s+projects|what\s+have\s+i\s+built|projects\s+i('ve|\s+have)\s+worked\s+on)\b/i.test(q) ||
    ((isDiscussingHarsh || isDiscussingDeveloper) && /\b(what\s+did\s+he\s+build|what\s+projects\s+did\s+he|what\s+has\s+he\s+built|his\s+projects)\b/i.test(q)) ||
    (/\b(projects?|apps?|applications?)\b/i.test(q) && /\b(i|my|harsh|he|his)\b/i.test(q) && !/\b(java|python|react|code|explain)\b/i.test(q))
  ) {
    const projectSummary = HARSH_PROFILE.projects.map((p) => `${p.name} (${p.title})`).join(", ");
    return {
      category: "projects_overview",
      content: `Subject: Harsh Shrivastava (Notable Projects). Projects: ${projectSummary}. (Provide a concise, conversational summary; focus on AIRA and DevWatchAI).`
    };
  }

  // 8. Technical Skills & Languages ("What are my skills?", "What technologies do I know?")
  if (
    /\b(what\s+are\s+my\s+skills|my\s+skills|what\s+technologies\s+do\s+i\s+know|what\s+languages\s+do\s+i\s+know|my\s+tech\s*stack)\b/i.test(q) ||
    ((isDiscussingHarsh || isDiscussingDeveloper) && /\b(what\s+are\s+his\s+skills|his\s+skills|what\s+technologies\s+does\s+he\s+know|his\s+tech\s*stack)\b/i.test(q)) ||
    (/\b(skills?|tech\s*stack|technologies)\b/i.test(q) && /\b(i|my|harsh|he|his)\b/i.test(q) && !/\b(explain|tutorial|how\s+to)\b/i.test(q))
  ) {
    return {
      category: "skills",
      content: `Subject: Harsh Shrivastava (Technical Skills). Languages: ${HARSH_PROFILE.skills.languages.join(", ")}; Frameworks: ${HARSH_PROFILE.skills.frameworks.join(", ")}; Databases: ${HARSH_PROFILE.skills.databases.join(", ")}; Tools: ${HARSH_PROFILE.skills.tools.join(", ")}.`
    };
  }

  // 9. Interview Preparation / Career Advice
  if (/\b(interview|sde\s+interview|prepare\s+for\s+(an|my)\s+interview|job\s+prep|resume\s+review)\b/i.test(q)) {
    return {
      category: "career_context",
      content: `Context: The user is a B.Tech CSE student (Parul University) and Software Engineer Intern (CrackTier) with full-stack React/Node/Firebase experience and 200+ LeetCode DSA problems solved. Silently use this context to tailor high-impact SDE advice without reciting their profile back to them.`
    };
  }

  // 10. Certifications ("What certifications do I have?")
  if (/\b(certif|certificates?|certified|certifications?)\b/i.test(q) && /\b(i|my|harsh|he|his)\b/i.test(q)) {
    return {
      category: "certifications",
      content: `Certifications: ${HARSH_PROFILE.certifications.join(", ")}.`
    };
  }

  // 11. Third-Person Creator / Developer Overview ("Tell me more about him", "Who is he?", "Tell me about Harsh")
  if (
    (isDiscussingHarsh || isDiscussingDeveloper) &&
    /\b(tell\s+me\s+more\s+about\s+him|tell\s+me\s+more|who\s+is\s+he|about\s+him|his\s+background|who\s+is\s+harsh|tell\s+me\s+about\s+harsh)\b/i.test(q)
  ) {
    return {
      category: "creator_summary_third_person",
      content: `Subject: Harsh Shrivastava (Developer/Creator). Details: Harsh is a software engineer and B.Tech CSE student (Parul University, SAP Specialization) working as a Software Engineer Intern at CrackTier. He built AIRA and DevWatchAI, specializing in full-stack development and AI systems.\n\nInstruction: Answer conversationally in the THIRD PERSON ("Harsh is...", "He is...", "His focus..."). Never use second-person ("You are...") for this third-person referent.`
    };
  }

  // 12. Second-Person User Overview ("What do you know about me?", "Tell me everything you know about me")
  if (
    /\b(what\s+do\s+you\s+know\s+about\s+me|tell\s+me\s+(everything|what)\s+you\s+know\s+about\s+me|who\s+am\s+i|about\s+me)\b/i.test(q)
  ) {
    return {
      category: "user_summary_second_person",
      content: `User Overview: Harsh Shrivastava is studying Computer Science and Engineering at Parul University (SAP Specialization) and working as a Software Engineer Intern at CrackTier. Key projects include AIRA and DevWatchAI.\n\nInstruction: Provide a natural, warm conversational overview in the SECOND PERSON ("You're a computer science student...", "You're working on...").`
    };
  }

  // For all other queries (math, standard code explanations, generic questions) -> Inject NOTHING!
  return null;
}
