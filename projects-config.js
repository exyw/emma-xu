// Verified asset paths and supplied public copy. The overview slots match the
// small SVGs' positions in Figma Frame 3 (node 2256:7748).
// colour names generated WebP versions of the small ASCII artwork for overview previews.
window.projectConfig = {
  "crop": { "x": 440, "y": 30, "width": 300, "height": 850 },
  "projects": [
    {
      "id": "chip", "title": "Adventures of Chip", "small": "Chip small.svg",
      "large": "Chip large.svg", "original": "CHIP asset.png", "colour": "chip.webp",
      "slot": { "x": 514, "y": 43, "width": 175, "height": 135 },
      "art": { "width": 211, "height": 181, "maxWidth": 330, "maxHeight": 285 },
      "meta": "Unity, C# · 2026",
      "paragraphs": [
        "Restrained by only the prompt of creating a game that imagines life 150 years in the future, Adventures of Chip is a 3D robot-simulation game made in 2026 for Graphics and Interaction (COMP30019).",
        "The player plays as CHIP, a household robot manufactured by the government, who must continue its chores without knowledge that its homeowners will never return following the apocalypse.",
        "My favourite learning: shaders; how we can transform an object from its object space to the 2d clipping space, and transform both its vertices and its fragments."
      ]
    },
    {
      "id": "wit", "title": "WIT", "small": "WIT logo small.svg",
      "large": "WIT logo large.svg", "original": "WIT logo asset.png", "colour": "wit.webp",
      "slot": { "x": 452, "y": 194, "width": 193, "height": 143 },
      "art": { "width": 351, "height": 251, "maxWidth": 400, "maxHeight": 285 },
      "meta": "React, TypeScript, CSS, Vite, Cloudflare · 2026",
      "paragraphs": [
        [
          "As the IT director of the Unimelb WIT (Women in Tech) club, I was fortunate to lead the development of a ",
          { "text": "new website", "href": "https://witunimelb.org.au/" },
          " for the club. This involved working with the graphics team, and translating their figma designs into an accessible and responsive website with my subcommittee."
        ],
        "Beyond the website, I revived our discord bot that allows members to easily access humanitix informaition for past and upcoming events. I also started the initative of a buddy system so that younger members within the subcomitte could be paired with final year students to learn skills not taught in the coursework and feel confident to contribte more within our clubs's technical projects.",
        "I was blessed to be part of the WIT committee, and learned a lot about how to lead a team, both in terms of delegating tasks and creating an environemnt where everyone is keen to contribute and learn."
      ]
    },
    {
      "id": "dk", "title": "Donkey Kong", "small": "DK small.svg",
      "large": "DK large.svg", "original": "DK asset.jpg", "colour": "dk.webp",
      "slot": { "x": 576, "y": 370, "width": 145, "height": 88 },
      "art": { "width": 528, "height": 323, "maxWidth": 500, "maxHeight": 306 },
      "meta": "Java · 2025"
    },
    {
      "id": "cnn", "title": "Brain Tumour Classifier", "small": "CNN small.svg",
      "large": "CNN large.svg", "original": "CNN asset.jpg", "colour": "cnn.webp",
      "slot": { "x": 483, "y": 497, "width": 173, "height": 53 },
      "art": { "width": 1262, "height": 362, "maxWidth": 610, "maxHeight": 175 },
      "meta": "CNN, Python, PyTorch, OpenCV · 2024",
      "paragraphs": [
        "I undertook this as a side project to learn about machine learning fundamentals and how to train a neural network from scratch. I used a kaggle dataset of brain MRI scans to train the CNN to classify whether the patient had pituitary, meningioma, glioma or no tumour.",
        "I spent a lot of the time adjusting the preprocessing pipeline of the images; scaling, augmenting and distorting the images. With tuning the hyperparameters of the CNN, i improved its its accuracy to 96%.", 
        "Looking back on this project, I think it is a testimony to how much frontier AI models have improved in the past few years, and how this CNN that I spent months training and tuning could now easily be outperformed by a oneshot prompt to a LLM. Having said that, I still believe there is a fundamental place in learning the basics and foundations of system design, machine learning principles, and etc. to be able to be critical of the outputs produced by agentic coding systems."
      ]
    },
    {
      "id": "connect3", "title": "Connect3", "small": "Connect3 small.svg",
      "large": "Connect3 large.svg", "original": "Connect3 asset.png", "colour": "connect3.webp",
      "slot": { "x": 488, "y": 747, "width": 126, "height": 104 },
      "art": { "width": 483, "height": 398, "maxWidth": 440, "maxHeight": 363 },
      "meta": "Next.js, TypeScript, Supabase, Agentic Systems · 2025-2026",
      "paragraphs": [
        [
          { "text": "Connect3", "href": "https://connect3.app/" },
          " is a student project - AI based platform that connects students to other students, clubs and events on campus. I joined as an AI developer and worked across various LLM based features, such as the RAG workflow to improve university related responses via better chunking, OpenAI embeddings and metadata filtering."
        ],
        "Like most student projects, I learnt a lot of the skills required as I had to ship out features quickly and efficiently. I also learnt a lot about how good communication is a vital factor to a succesful project.",
        "The most surprising part of this project was after our first official launch, and I realised how much of an 'AI bubble' I personlly am in, and so this project also sparked my interest in creating AI platforms that cater to the general public, and not just those who are already familiar with AI."
      ]
    }
  ]
};
