/* Portfolio content — single source of data for the UI kit.
   Mirrors khaliddosari/portfolio static/index.html. Exposed on window. */
window.PORTFOLIO = {
  identity: {
    nameAr: 'خالد آل دوســـــري',
    nameEn: 'Khalid Al Dosari',
    tagline: 'CS Student | Data Scientist | AI Engineer',
    sidebarTagline: 'Data Scientist | AI Engineer',
    email: 'khaliddosari70@gmail.com',
    phone: '+966 55 322 5155',
    linkedin: 'https://www.linkedin.com/in/khalid-al-dosari/',
    github: 'https://github.com/khaliddosari',
  },
  nav: [
    { id: 'about', label: 'About', icon: 'fa-user' },
    { id: 'education', label: 'Education', icon: 'fa-graduation-cap' },
    { id: 'projects', label: 'Projects', icon: 'fa-folder-open' },
    { id: 'experience', label: 'Experience', icon: 'fa-briefcase' },
    { id: 'certifications', label: 'Certifications', icon: 'fa-award' },
    { id: 'skills', label: 'Skills', icon: 'fa-laptop-code' },
    { id: 'languages', label: 'Languages', icon: 'fa-language' },
  ],
  about: [
    "Focused on applied artificial intelligence, I specialize in building intelligent, end-to-end solutions powered by machine learning and agentic AI. I design scalable, production-ready solutions that turn raw data into actionable insights and real-world impact. Built a strong foundation in Python, data science, machine learning, deep learning, agentic workflows and LLMs.",
    "I've also spent nearly three years supervising operations for some of Saudi Arabia's biggest and most prestigious events, also volunteering and leading in student clubs. That experience taught me how to lead under pressure, coordinate across teams, and solve problems in real time, skills that translate directly into any environment.",
  ],
  education: {
    school: 'Imam Mohammad bin Saud Islamic University',
    degree: "Bachelor's degree, Computer Science",
    dates: 'August 2022 - present',
    logo: '../../assets/logos/university-logo.jpg',
    volunteering: [
      'Built a strong foundation in software engineering, machine learning, and artificial intelligence, applied directly to deployed projects.',
      'Active in extracurricular activities as Media & Design Deputy Leader at CCIS Student Council and a graphic design volunteer at Tuwaiq Club, Google Developers Student Club and Information Security Club.',
    ],
  },
  projects: [
    { title: 'Namtheg AutoML', desc: 'An end-to-end, agentic Automated Machine Learning platform that automates the entire ML pipeline. Upload a raw dataset, select a target variable, train a custom model, and deploy it to a production-ready cloud via API.', tags: ['Python', 'FastAPI', 'NEXT.JS', 'Modal', 'LangChain', 'DeepSeek API', 'TypeScript', 'React', 'Render'], code: 'https://github.com/khaliddosari/AutoML', demo: 'https://namtheg.onrender.com/' },
    { title: 'Nusuk', desc: 'An agentic course recommender for students considering electives. It takes your academic transcript as input, parses your grades and recommends 5 courses that best fit you based on previous grades of relevant courses.', tags: ['Python', 'JavaScript', 'Node.js', 'MongoDB', 'HTML', 'CSS', 'Gemini API'], code: 'https://github.com/khaliddosari/web-project', demo: null },
    { title: '3ajib', desc: 'An AI-powered tourism intelligence platform built for PwC Empowerthon (4th place). Helps Saudi destination owners turn visitor data into actionable insights with an AI demo, ROI calculator, analytics dashboard, and bilingual support.', tags: ['React', 'TypeScript', 'Vite', 'Supabase', 'Voiceflow', 'HTML', 'JavaScript', 'CSS'], code: 'https://github.com/khaliddosari/3ajib', demo: 'https://khaliddosari.github.io/3ajib/' },
    { title: 'Cashy - Cash Back Optimizer', desc: 'An algorithms project comparing Brute Force (O(nᵐ)) and Greedy (O(n × m)) approaches to optimize cashback across multiple cards and spending categories — the classic tradeoff between optimality and efficiency.', tags: ['Java', 'HTML', 'JavaScript', 'CSS', 'Cloudflare'], code: 'https://github.com/khaliddosari/cashback-optimizer', demo: 'https://khaliddosari.github.io/cashback-optimizer/' },
    { title: 'N-Queens CSP', desc: 'An AI course project solving the N-Queens problem using three CSP algorithms — Backtracking, Forward Checking, and MAC — enhanced with MRV, Degree, and LCV heuristics, with an interactive visualizer.', tags: ['Java', 'Spring Boot', 'Maven', 'HTML', 'JavaScript', 'CSS'], code: 'https://github.com/khaliddosari/n-queens', demo: 'https://n-queens.up.railway.app/' },
    { title: 'LALR Parser', desc: 'A compilers course project: LALR(1) parsing built from scratch in Java. Constructs the full canonical LR(1) item sets, merges same-core states into an LALR table, detects conflicts, and parses with a step-by-step trace.', tags: ['Java', 'Spring Boot', 'Maven', 'REST API', 'Docker', 'HTML', 'JavaScript', 'CSS'], code: 'https://github.com/khaliddosari/lalr-parser', demo: 'https://lalr-parser.fly.dev/' },
  ],
  experience: [
    { role: 'Media & Design Deputy Lead', org: 'CCIS Student Council', dates: 'September 2025 - Present', logo: '../../assets/logos/council-logo.jpg', points: ['Manage team efforts by assigning tasks, reviewing performance, and setting both goals and milestones.', 'Oversee the completion of tasks, ensuring that visual identity guidelines are consistently met.', 'Set agendas and lead meetings with relevant parties to drive productivity and alignment.'] },
    { role: 'Zone Manager', org: 'THA Staffing', dates: 'Jan 2026 - Present', logo: '../../assets/logos/company-logo.jpg', points: ['Supervised teams in critical and prestigious events and conferences for multiple government and private entities.', 'Ensured smooth operations and managed coordination of team members and oversaw tasks to completion.'] },
    { role: 'Team Supervisor', org: 'Webook', dates: 'October 2024 - November 2025', logo: '../../assets/logos/webook-logo.jpg', points: ['Supervised teams in popular high-rush events, for several ministries.', 'Coordinated directly with clients and operation managers, achieving goals and events success.'] },
  ],
  certifications: [
    { title: 'Data Science Bootcamp', org: 'OSS Vision Community', date: 'April 2026', logo: '../../assets/logos/OSS_Vision_logo.jpg', link: '#', linkLabel: 'Verify', icon: 'fa-external-link-alt' },
    { title: 'Supervised Machine Learning: Regression and Classification', org: 'DeepLearning.AI', date: 'April 2026', logo: '../../assets/logos/deeplearningai_logo.jpg', link: '#', linkLabel: 'Verify', icon: 'fa-external-link-alt' },
    { title: 'Introduction to Data Science in Python', org: 'University of Michigan', date: 'April 2026', logo: '../../assets/logos/Michigan_logo.jpg', link: '#', linkLabel: 'Verify', icon: 'fa-external-link-alt' },
    { title: 'Calculus for Machine Learning and Data Science', org: 'DeepLearning.AI', date: 'February 2026', logo: '../../assets/logos/deeplearningai_logo.jpg', link: '#', linkLabel: 'Verify', icon: 'fa-external-link-alt' },
    { title: 'Python Programming', org: 'MCIT', date: 'July 2023', logo: '../../assets/logos/MCIT_logo.jpg', link: '#', linkLabel: 'PDF', icon: 'fa-file-pdf' },
  ],
  skills: [
    { group: 'Programming Languages', tags: ['Python', 'Java', 'SQL', 'JavaScript', 'TypeScript', 'HTML', 'CSS'] },
    { group: 'Model Architecture', tags: ['CNNs', 'RNNs', 'Auto-encoders', 'Gradient Boosting', 'Random Forests', 'Anomaly Detection'] },
    { group: 'Databases', tags: ['PostgreSQL', 'MySQL', 'MongoDB'] },
    { group: 'Cloud & Infrastructure', tags: ['Modal', 'Cloudflare', 'Vercel'] },
    { group: 'Specialized Domains', tags: ['Data Science', 'Machine Learning', 'Deep Learning', 'Natural Language Processing (NLP)', 'Computer Vision', 'Data Visualization', 'Agentic AI', 'AI-Native Engineering', 'MLOps'] },
    { group: 'Libraries, Tools & Frameworks', tags: ['PyTorch', 'TensorFlow', 'Scikit-learn', 'LangChain', 'LangGraph', 'FastAPI', 'RestAPI', 'Next.js', 'Pandas', 'NumPy', 'Matplotlib', 'Power BI', 'Excel', 'Overleaf'] },
    { group: 'DevOps & Environments', tags: ['Git', 'GitHub', 'Bash', 'Docker', 'Spring Boot', 'Maven', 'Jupyter', 'VS Code', 'Google Colab', 'Render', 'Fly.io'] },
    { group: 'Soft Skills', tags: ['Leadership', 'Project Management', 'Teamwork', 'Communication Skills', 'Problem Solving'] },
  ],
  languages: ['Arabic', 'English'],
};
