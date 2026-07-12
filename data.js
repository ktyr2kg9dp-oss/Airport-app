/*
 * Cup-Les — phrase catalogue.
 *
 * Each button sends ONE random phrase (out of ten) to the partner's app.
 * These arrays are shared by the browser (loaded via <script>) and are the
 * single source of truth for every message the app can send.
 *
 * Keys map to buttons:
 *   bow       — wife  → husband : praise
 *   mad       — husband → wife   : he's upset, something went wrong
 *   bad       — husband → wife   : she wasn't behaving nicely
 *   cucumber  — husband → wife   : he wants some intimacy 🥒
 */
const PHRASES = {
  // Wife's only button. Praise for the husband.
  bow: [
    "You are the strongest, most capable man I know. 💪",
    "I'm so proud to call you my husband. ❤️",
    "You make our home feel safe and warm every single day.",
    "Thank you for everything you do for us — you're amazing.",
    "I trust your judgment completely. You're the smartest man I know.",
    "My hero. Everything in my life is better because of you.",
    "You work so hard for us, and I notice every bit of it.",
    "I admire the man you are more than words can say.",
    "You always know how to make me smile. I adore you.",
    "The best decision I ever made was saying yes to you.",
  ],

  // Husband → wife. He's mad because something went wrong.
  mad: [
    "Your husband is a little upset — something didn't go quite right. 😠",
    "Uh oh… he's mad. He feels something wasn't done the way it should be.",
    "Your husband is frustrated right now. Maybe check in with him. 😤",
    "He's not happy — he thinks a mistake was made. Time to talk it out.",
    "Your husband is annoyed about something that went wrong today.",
    "He's a bit angry. He feels let down by something that happened.",
    "Heads up: your husband is upset and needs to clear the air. 😠",
    "Something crossed a line for him — he's mad. Give him a moment.",
    "Your husband's patience ran thin today. He's not pleased.",
    "He's upset — he feels something just wasn't handled the right way.",
  ],

  // Husband → wife. She wasn't behaving nicely.
  bad: [
    "Your husband feels you weren't very nice just now. 🙁",
    "That wasn't your kindest moment, and he noticed.",
    "He thinks you could have been a little sweeter today.",
    "Your husband felt a bit hurt by the way things went.",
    "Not your gentlest moment — he'd love a little more warmth.",
    "He feels you were a touch unkind. A bit of tenderness would help.",
    "Your husband thinks you weren't behaving very nicely. 😕",
    "That stung a little — he wishes you'd been gentler.",
    "He feels the kindness was missing. Show him some love. 💛",
    "Your husband would really appreciate a nicer tone right now.",
  ],

  // Husband → wife. He wants some intimacy. 🥒
  cucumber: [
    "Your husband is thinking about you… and only you. 🥒😉",
    "He's in the mood for some closeness tonight. 😏",
    "Your husband would love a little private time with you. 🥒",
    "He's craving your touch. Care to join him? 😉",
    "Someone's feeling romantic — he wants you all to himself. 🥒",
    "Your husband is longing for an intimate evening with you. 😘",
    "He can't stop thinking about being close to you tonight. 🥒",
    "Your husband is in the mood for some grown-up cuddles. 😉",
    "He's hoping for a little spark between the two of you tonight. 🔥",
    "Your husband desires you… meet him for some quality time. 🥒😏",
  ],
};

// Human-readable labels + styling hints for each message kind, used when a
// received message is rendered in the partner's feed.
const KINDS = {
  bow:      { title: "A word of love 💖",    tone: "love"     },
  mad:      { title: "He's upset 😠",         tone: "mad"      },
  bad:      { title: "Be a little nicer 🙁", tone: "bad"      },
  cucumber: { title: "He wants you 🥒",       tone: "cucumber" },
};

// Node (server) can require this file; browsers just get the globals above.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PHRASES, KINDS };
}
