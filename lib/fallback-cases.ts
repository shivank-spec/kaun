import type { CaseFile } from "./types";

// Backup cases used when the AI is busy, so the game never stalls.
// Written by the case engine during the build, then frozen. Neutral settings:
// no city, no real street, so anyone anywhere can follow them.
export const FALLBACK_CASES: CaseFile[] = [
  {
    "clues": [
      {
        "id": "c1",
        "text": "Handprint on case seen by guard",
        "held_by": "s1",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "Security log shows door unlocked at 11:45",
        "held_by": "s2",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "Receipt for rare book at 10:30",
        "held_by": "s3",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "Phone call to ex at 11:10",
        "held_by": "s1",
        "points_to": "s2",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "Muddy footprint near window",
        "held_by": "s3",
        "points_to": "s1",
        "is_red_herring": true
      }
    ],
    "crime": "Swapped the manuscript for a replica",
    "facts": {
      "what": "Rare manuscript stolen",
      "when": "11:15‑12:30",
      "where": "Display case, East Wing"
    },
    "intro": "The night air was thick with anticipation as the museum opened its doors to a rare collection. A silent, unseen hand moved among the artifacts, leaving only a whisper of deceit.",
    "roast": "You thought you could clean up a crime, Varun—turns out you were just a janitor in a bad play.",
    "title": "The Missing Manuscript",
    "method": "Swapped the original manuscript with a replica during the shift change",
    "motive": "Pay off gambling debt",
    "setting": "Night of the New Exhibition at a City Museum",
    "suspects": [
      {
        "id": "s1",
        "name": "Sana Kapoor",
        "role": "Security Guard",
        "persona": "Stoic, observant",
        "public_alibi": "I was on watch from 10:00‑12:00",
        "speaking_style": "Matter‑of‑fact",
        "innocent_secret": "I cleaned the display case early"
      },
      {
        "id": "s4",
        "name": "Varun Chatterjee",
        "role": "Cleaner",
        "persona": "Quiet, practical",
        "public_alibi": "I was sweeping the hallway at 11:30",
        "speaking_style": "Brief",
        "innocent_secret": "I was preparing the exhibit, had to move the case"
      },
      {
        "id": "s2",
        "name": "Siddharth Sen",
        "role": "Manager",
        "persona": "Authoritative, meticulous",
        "public_alibi": "I handled inventory at 11:20",
        "speaking_style": "Direct",
        "innocent_secret": "I called my sister for advice"
      },
      {
        "id": "s3",
        "name": "Aisha Bose",
        "role": "Curator",
        "persona": "Enthusiastic, detail‑oriented",
        "public_alibi": "I met a scholar at the library at 11:45",
        "speaking_style": "Descriptive",
        "innocent_secret": "I met a scholar at the library"
      }
    ],
    "timeline": [
      "11:15 11:15 pm Shift change starts",
      "11:30 11:30 pm Culprit swaps the manuscript",
      "12:00 12:00 pm Security logs door unlock",
      "12:30 12:30 pm Culprit leaves the museum"
    ],
    "alibi_hole": "Door card swipe shows Varun's card at 11:30",
    "crime_verb": "Find who swapped the manuscript for a fake",
    "culprit_id": "s4",
    "ending_caught": "Varun was caught when the museum’s new security system logged his card swipe at 11:30. His planned swap unraveled with a single misplaced fingerprint.",
    "ending_escaped": "Varun slipped through the back exit, claiming he was sweeping. The guard’s brief, unverified statement and the empty hallway let him vanish into the night.",
    "culprit_objective": "Convince everyone the CCTV was already down at 11:20"
  },
  {
    "clues": [
      {
        "id": "c1",
        "text": "A single, pristine coffee cup found near the server room door.",
        "held_by": "s1",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "Security footage shows Varun Sen leaving his station at 1:15 AM.",
        "held_by": "s3",
        "points_to": "s2",
        "is_red_herring": true
      },
      {
        "id": "c3",
        "text": "A faint smudge of non-standard lubricant on the server rack's access panel.",
        "held_by": "s2",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "Aditya Roy's access card was used to enter the server room floor at 11:30 PM.",
        "held_by": "s4",
        "points_to": "s3",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "A USB drive with a cracked screen left behind in the server room.",
        "held_by": "s3",
        "points_to": "s4",
        "is_red_herring": false
      }
    ],
    "crime": "The company's flagship software source code was stolen.",
    "facts": {
      "what": "Proprietary source code for 'Project Chimera'.",
      "when": "Between 11:00 PM and 5:00 AM.",
      "where": "Apex Innovations' secure server room."
    },
    "intro": "The air in Apex Innovations crackled with anticipation. Tonight, the future of the company, their revolutionary new OS, was secured. But as dawn broke, the digital vault lay empty. The code, years of work, was gone.",
    "roast": "She thought a bit of ambition and a cracked USB would be her ticket to the big leagues. Turns out, ambition without competence is just a faster way to get caught.",
    "title": "The Leaked Source Code",
    "method": "Used her administrative access, gained during her probation period, to copy the code to a hidden partition on her personal drive.",
    "motive": "Financial gain by selling the code to a rival company.",
    "setting": "Apex Innovations' sleek, modern office, the night before a major product launch.",
    "suspects": [
      {
        "id": "s4",
        "name": "Riya Sarkar",
        "role": "Junior Coder",
        "persona": "Quiet, observant, and often underestimated. Eager to prove her worth.",
        "public_alibi": "Worked late in her cubicle, left at 2:00 AM.",
        "speaking_style": "Soft-spoken, hesitant, but observant of details.",
        "innocent_secret": "Was practicing a complex coding challenge for an upcoming hackathon."
      },
      {
        "id": "s2",
        "name": "Varun Sen",
        "role": "Network Administrator",
        "persona": "Methodical, cautious, and fiercely loyal to the company's security protocols.",
        "public_alibi": "Monitored server activity from the main security desk all night.",
        "speaking_style": "Precise, calm, uses technical jargon sparingly.",
        "innocent_secret": "Has a gambling debt he's desperately trying to hide."
      },
      {
        "id": "s3",
        "name": "Aditya Roy",
        "role": "Product Manager",
        "persona": "Smooth, persuasive, and always looking for an angle. Stressed about the launch's success.",
        "public_alibi": "Left at 10:00 PM after a final launch review meeting.",
        "speaking_style": "Polite, slightly evasive, uses business buzzwords.",
        "innocent_secret": "Was secretly meeting with a venture capitalist about a side project."
      },
      {
        "id": "s1",
        "name": "Kavya Chatterjee",
        "role": "Lead Developer",
        "persona": "Ambitious, brilliant, and slightly arrogant. Believes she deserves more recognition.",
        "public_alibi": "Was debugging in the quiet zone until midnight, then left.",
        "speaking_style": "Technical, direct, with a hint of impatience.",
        "innocent_secret": "Secretly took a confidential competitor's interview earlier that week."
      }
    ],
    "timeline": [
      "11:00 PM: Server room access log shows a routine check by Varun Sen.",
      "1:30 AM: Riya Sarkar is seen leaving her cubicle, heading towards the server room area.",
      "1:45 AM: A brief, unscheduled power fluctuation is detected in the server room.",
      "2:00 AM: Riya Sarkar swipes out at the main entrance.",
      "3:00 AM: Kavya Chatterjee is seen briefly in the server room corridor.",
      "4:30 AM: The main server begins its backup cycle, revealing the missing code."
    ],
    "alibi_hole": "Riya Sarkar claimed to leave at 2:00 AM, but her final security log-out was at 2:05 AM.",
    "crime_verb": "stole the company's source code",
    "culprit_id": "s4",
    "ending_caught": "Riya Sarkar's quiet demeanor masked a calculated betrayal. The cracked USB drive contained fragments of the stolen code, a signature left by her desperate ambition. Her minor delay in exiting, a mere five minutes, unraveled her entire scheme.",
    "ending_escaped": "Riya Sarkar blended back into the anonymity of the night, the valuable source code a ghost in the digital ether. The company was left shattered, their future compromised, and Riya was already on a plane, code in hand, to a new, lucrative life.",
    "culprit_objective": "To make it appear as though the breach happened during a system glitch between 1:30 AM and 2:00 AM."
  },
  {
    "clues": [
      {
        "id": "c1",
        "text": "A faint smudge of grease found on the vault door handle.",
        "held_by": "s1",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "Security logs show a brief, unexplained power fluctuation in the vault corridor.",
        "held_by": "s2",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "A torn piece of paper with gambling syndicate symbols found near the vault.",
        "held_by": "s4",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "Yash Sinha was seen talking to a person outside the studio gates.",
        "held_by": "s2",
        "points_to": "s1",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "Neil D'Souza's tool bag has a small dent matching a prop casing.",
        "held_by": "s1",
        "points_to": "s4",
        "is_red_herring": true
      }
    ],
    "crime": "The master copy of the director's cut film reel.",
    "facts": {
      "what": "Master film reel",
      "when": "Between 10 PM and 2 AM last night",
      "where": "The secure vault on Stage 4"
    },
    "intro": "The final day of shooting. A dream project, weeks behind schedule, and now, disaster strikes. The master reel, the sole copy of the director's cut, has vanished. Without it, the film is dead in the water.",
    "roast": "He tried to play director, but ended up just a prop in his own downfall.",
    "title": "The Missing Master Reel",
    "method": "Used his access as Assistant Director to bypass security protocols and remove the reel during a shift change, then hid it in a prop crate.",
    "motive": "To sell the reel to a rival production company to cover gambling debts.",
    "setting": "A bustling film studio on the final day of shooting. Chaos reigns supreme.",
    "suspects": [
      {
        "id": "s3",
        "name": "Imran Jalan",
        "role": "Assistant Director",
        "persona": "Ambitious, slightly arrogant, always in control.",
        "public_alibi": "Coordinating the final shots, supervising the crew on set.",
        "speaking_style": "Confident, often condescending, uses industry jargon.",
        "innocent_secret": "Has a significant gambling debt he's desperately trying to hide."
      },
      {
        "id": "s4",
        "name": "Neil D'Souza",
        "role": "Sound Mixer",
        "persona": "Gruff, cynical, seen it all.",
        "public_alibi": "Packing up sensitive equipment in Studio 2, across the lot.",
        "speaking_style": "Sarcastic and blunt, dismissive of studio drama.",
        "innocent_secret": "Accidentally damaged a piece of expensive equipment and was trying to fix it."
      },
      {
        "id": "s1",
        "name": "Yash Sinha",
        "role": "Studio Security Guard",
        "persona": "Overly eager to please, a bit jumpy.",
        "public_alibi": "Patrolling the main lot, saw nothing unusual.",
        "speaking_style": "Polite but anxious, speaks quickly.",
        "innocent_secret": "Was secretly meeting his girlfriend on a remote part of the lot."
      },
      {
        "id": "s2",
        "name": "Mira Fernandes",
        "role": "Lead Editor",
        "persona": "Calm, collected, and incredibly organized.",
        "public_alibi": "Working late in the editing suite, just down the hall.",
        "speaking_style": "Measured and precise, avoids speculation.",
        "innocent_secret": "Fell asleep at her desk for an hour, missed a crucial part of the timeline."
      }
    ],
    "timeline": [
      "10:00 PM: Final scene wraps, actors leave.",
      "11:30 PM: Crew begins packing; reel is secured in vault.",
      "1:15 AM: Imran Jalan is seen near the vault entrance.",
      "1:45 AM: Reel is reported missing by Yash Sinha.",
      "2:00 AM: Imran Jalan supervises prop removal from Stage 4."
    ],
    "alibi_hole": "He claimed to be on set, but camera footage shows him by the vault.",
    "crime_verb": "stole the master film reel",
    "culprit_id": "s3",
    "ending_caught": "Imran Jalan thought he was too clever, too in control. He underestimated the grease on the vault door and the symbols of his desperation. The reel was found stashed in a prop coffin, just as the buyer arrived.",
    "ending_escaped": "The betting slips were too damning, the contact too exposed. A quick call to his fence, a desperate gamble, and Imran Jalan vanished into the night, the master reel a ghost in the bustling studio.",
    "culprit_objective": "To make it look like a random security failure or an outside job."
  },
  {
    "clues": [
      {
        "id": "c1",
        "text": "Fingerprint on trophy handle",
        "held_by": "s2",
        "points_to": "s1",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "Video frame of shadow near trophy",
        "held_by": "s3",
        "points_to": "s1",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "Note in locker B saying replace tomorrow",
        "held_by": "s4",
        "points_to": "s1",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "Broken lock key in trash",
        "held_by": "s1",
        "points_to": "s2",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "Missing ticket stub from match day",
        "held_by": "s3",
        "points_to": "s4",
        "is_red_herring": true
      }
    ],
    "crime": "swapped the trophy for a fake",
    "facts": {
      "what": "trophy swapped",
      "when": "3:45 pm",
      "where": "locker room B"
    },
    "intro": "The championship trophy vanished from locker room B at 3:45 pm. A silent theft rattled the stadium’s security team.",
    "roast": "Nikhil Rao, the only guard who could swipe a trophy without a security breach.",
    "title": "The Missing Trophy",
    "method": "used his badge to access locker B, swapped trophy, left no trace",
    "motive": "to cover a secret security system deal",
    "setting": "Stadium locker room B on match day",
    "suspects": [
      {
        "id": "s3",
        "name": "Farhan Mehta",
        "role": "cleaner",
        "persona": "quiet, detail‑oriented",
        "public_alibi": "cleaning locker rooms at 3:43 pm",
        "speaking_style": "soft",
        "innocent_secret": "taking a late‑night call from a friend"
      },
      {
        "id": "s4",
        "name": "Sana Mitra",
        "role": "chef",
        "persona": "energetic, practical",
        "public_alibi": "preparing concessions at 3:41 pm",
        "speaking_style": "cheerful",
        "innocent_secret": "meeting a supplier for new kitchen gear"
      },
      {
        "id": "s1",
        "name": "Nikhil Rao",
        "role": "security guard",
        "persona": "calm, observant",
        "public_alibi": "on patrol at checkpoint from 3:30 to 4:00 pm",
        "speaking_style": "straightforward",
        "innocent_secret": "meeting a supplier for a new security part"
      },
      {
        "id": "s2",
        "name": "Dev Jalan",
        "role": "manager",
        "persona": "assertive, meticulous",
        "public_alibi": "reviewing match footage at 3:44 pm",
        "speaking_style": "concise",
        "innocent_secret": "discussing promotion plans with a rival"
      }
    ],
    "timeline": [
      "3:30 pm guard patrol",
      "3:42 pm guard entered locker B",
      "3:44 pm trophy swapped",
      "3:45 pm guard exited",
      "4:00 pm guard returned to checkpoint",
      "4:10 pm manager noted missing trophy"
    ],
    "alibi_hole": "CCTV shows guard entering locker B at 3:42 pm",
    "crime_verb": "swapped the trophy for a fake",
    "culprit_id": "s1",
    "ending_caught": "The detective matched the fingerprint, the video shadow, and the note; Nikhil’s badge was found abandoned. His false claim crumbled, and he was arrested.",
    "ending_escaped": "If he’d slipped past the badge, he could have walked away with the fake trophy. The slip was his left badge on the bench.",
    "culprit_objective": "Convince everyone the trophy had been damaged in transit"
  },
  {
    "clues": [
      {
        "id": "c1",
        "text": "Guard saw chef enter the back kitchen with the book",
        "held_by": "s1",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "Manager saw chef near the recipe shelf at 9:48",
        "held_by": "s2",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "Cleaner found the book on the prep table, missing the original",
        "held_by": "s3",
        "points_to": "s4",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "Manager claims guard left the kitchen at 9:30",
        "held_by": "s2",
        "points_to": "s1",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "Guard says cleaner was out of the kitchen",
        "held_by": "s1",
        "points_to": "s3",
        "is_red_herring": true
      }
    ],
    "crime": "stolen secret recipe book",
    "facts": {
      "what": "recipe book stolen",
      "when": "9:45-10:00 pm",
      "where": "back kitchen"
    },
    "intro": "When the city’s top critic arrived, the kitchen buzzed with whispers of a secret dish. Behind the clatter, a priceless book vanished in the dark.",
    "roast": "Chef Nikhil, who thinks a recipe is treasure, turned his own kitchen into a vault.",
    "title": "The Midnight Recipe Heist",
    "method": "Used a disguised recipe book to swap with a fake",
    "motive": "Own the recipe, profit from exclusive sale",
    "setting": "A famous restaurant on a critic’s night",
    "suspects": [
      {
        "id": "s1",
        "name": "Yash Sinha",
        "role": "Security Guard",
        "persona": "stoic, precise",
        "public_alibi": "On patrol, checked the cameras.",
        "speaking_style": "dry, factual",
        "innocent_secret": "Late shift coffee break."
      },
      {
        "id": "s3",
        "name": "Vikram Bose",
        "role": "Cleaner",
        "persona": "quiet, observant",
        "public_alibi": "Cleaning the service area.",
        "speaking_style": "low‑key, blunt",
        "innocent_secret": "Hidden debt to a loan shark."
      },
      {
        "id": "s4",
        "name": "Nikhil Agarwal",
        "role": "Chef",
        "persona": "creative, passionate",
        "public_alibi": "Preparing the critic’s signature dish.",
        "speaking_style": "boastful, dramatic",
        "innocent_secret": "Claimed he was on a break cleaning the pantry."
      },
      {
        "id": "s2",
        "name": "Sanjana Kapoor",
        "role": "Restaurant Manager",
        "persona": "energetic, organized",
        "public_alibi": "Overseeing the critic’s table.",
        "speaking_style": "friendly, reassuring",
        "innocent_secret": "Had a meeting with a rival chef."
      }
    ],
    "timeline": [
      "09:30 09:30",
      "09:45 09:45",
      "09:50 09:50",
      "09:55 09:55",
      "10:00 10:00"
    ],
    "alibi_hole": "Security log shows chef in kitchen 09:47-09:53",
    "crime_verb": "stole the recipe codex",
    "culprit_id": "s4",
    "ending_caught": "The chef slipped the fake book into the real one during prep. The guard’s footage finally showed him in the back kitchen, and the manager’s phone call at 10:00 confirmed it. The evidence was too clean, too timed. The chef was caught, apron on, a guilty smile on his face.",
    "ending_escaped": "He slipped away during the rush, his head bowed to the critics’ applause. The book vanished into his pocket, the critic’s mystery solved, the chef’s secret recipe now a legend.",
    "culprit_objective": "Convince everyone the kitchen lights were off at 9:48"
  }
];
