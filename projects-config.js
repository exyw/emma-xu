// Verified asset paths and supplied public copy. The overview slots match the
// small SVGs' positions in Figma Frame 3 (node 2256:7748).
// CHIP's source PNG has wide transparent padding, so its image box is wider
// than the slot while the visible artwork stays smaller and meets its bottom.
window.projectConfig = {
  "crop": { "x": 440, "y": 30, "width": 300, "height": 850 },
  "projects": [
    {
      "id": "chip", "title": "Adventures of Chip", "small": "Chip small.svg",
      "large": "Chip large.svg", "original": "CHIP asset.png",
      "slot": { "x": 514, "y": 43, "width": 175, "height": 135 },
      "preview": { "width": "175%", "height": "auto", "top": "auto", "left": "50%", "bottom": "0", "transform": "translateX(-50%)" },
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
      "large": "WIT logo large.svg", "original": "WIT logo asset.png",
      "slot": { "x": 452, "y": 194, "width": 193, "height": 143 },
      "art": { "width": 351, "height": 251, "maxWidth": 400, "maxHeight": 285 }
    },
    {
      "id": "dk", "title": "DK", "small": "DK small.svg",
      "large": "DK large.svg", "original": "DK asset.jpg",
      "slot": { "x": 576, "y": 370, "width": 145, "height": 88 },
      "preview": { "width": "78%", "height": "auto", "top": "5%", "left": "auto", "right": "5%", "transform": "none" },
      "art": { "width": 528, "height": 323, "maxWidth": 500, "maxHeight": 306 }
    },
    {
      "id": "cnn", "title": "CNN", "small": "CNN small.svg",
      "large": "CNN large.svg", "original": "CNN asset.jpg",
      "slot": { "x": 483, "y": 497, "width": 173, "height": 53 },
      "preview": { "width": "78%", "height": "auto", "top": "auto", "left": "5%", "bottom": "5%", "transform": "none" },
      "art": { "width": 1262, "height": 362, "maxWidth": 610, "maxHeight": 175 }
    },
    {
      "id": "connect3", "title": "Connect3", "small": "Connect3 small.svg",
      "large": "Connect3 large.svg", "original": "Connect3 asset.png",
      "slot": { "x": 488, "y": 747, "width": 126, "height": 104 },
      "preview": { "width": "70%", "height": "auto", "top": "8%", "left": "1%", "transform": "none" },
      "art": { "width": 483, "height": 398, "maxWidth": 440, "maxHeight": 363 }
    }
  ]
};
