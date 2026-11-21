import type { CaseFile } from "./types";

// Backup cases used when the AI is slow or returns a broken puzzle, so the game
// never stalls on stage. Written by the case engine during the build, then frozen.
export const FALLBACK_CASES: CaseFile[] = [
  {
    "title": "The Salt Lake Data Heist",
    "setting": "Tech startup NexusAI, Salt Lake Sector V, Bangalore, 9 pm‑12 am, night before Series A funding round",
    "crime": "unauthorized extraction of proprietary source code and client data from the company server",
    "crime_verb": "exfiltrated the source code and client data",
    "intro": "The clock struck nine as the office lights dimmed, but the servers kept humming. NexusAI’s future hinged on a demo that would unveil tomorrow, yet a silent intruder slipped through the digital walls and walked away with the company’s most valuable asset.",
    "suspects": [
      {
        "id": "s1",
        "name": "Rohit Banerjee",
        "role": "Head of Product",
        "persona": "Meticulous, data‑driven, speaks in measured bullet points",
        "speaking_style": "Rohit: \"The sprint metrics show a 12% variance, we need to address it.\"",
        "public_alibi": "Attended a virtual board meeting from 9:15 pm to 10:30 pm, screen share logged",
        "innocent_secret": "Has been negotiating a silent exit with a rival startup"
      },
      {
        "id": "s2",
        "name": "Maya Ghosh",
        "role": "Senior DevOps Engineer",
        "persona": "Calm under pressure, uses tech slang, concise",
        "speaking_style": "Maya: \"Pinged the firewall, everything's green. No anomalies.\"",
        "public_alibi": "Was on a video call with the cloud vendor from 9:45 pm to 10:20 pm, call logs present",
        "innocent_secret": "Was planning a surprise birthday party for her sister, bought a cake at 10 pm"
      },
      {
        "id": "s3",
        "name": "Arun Chatterjee",
        "role": "Lead Software Architect",
        "persona": "Charismatic, persuasive, often uses rhetorical questions",
        "speaking_style": "Arun: \"If we don't secure this, who's to blame?\"",
        "public_alibi": "Left the office at 9:30 pm, claimed to go home for a family dinner",
        "innocent_secret": "Had a secret meeting with an investor from a competing firm at 10 pm"
      },
      {
        "id": "s4",
        "name": "Sneha Dutta",
        "role": "Finance Manager",
        "persona": "Detail‑oriented, formal, often cites numbers",
        "speaking_style": "Sneha: \"The expense report shows a Rs 2.3 lakh variance, we must audit.\"",
        "public_alibi": "Was reconciling invoices in the finance room from 9:00 pm to 10:05 pm, badge swipe recorded",
        "innocent_secret": "Borrowed Rs 1.5 lakh from a loan shark to cover her sister's medical bills"
      }
    ],
    "culprit_id": "s3",
    "motive": "Earn a lucrative consulting contract from the rival investor by delivering the stolen code",
    "method": "Used his admin access to clone the /var/www/nexus repo to an external USB, then slipped it out during his ‘family dinner’ alibi",
    "timeline": [
      "21:00 Server logs show admin login from Arun’s credentials",
      "21:12 CCTV captures Arun exiting through side door, badge swipe recorded",
      "21:25 Maya’s firewall monitor shows a brief 30‑second outbound data spike",
      "21:40 Rohit’s screen share ends, he logs off workstation",
      "22:00 Sneha’s badge used to enter finance room, no server activity",
      "22:30 USB device detected on endpoint at 22:31, later removed"
    ],
    "clues": [
      {
        "id": "c1",
        "text": "Server log entry: admin user ‘arunch’ accessed /var/www/nexus at 21:00 and executed ‘git clone’",
        "held_by": "s2",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "CCTV frame 21:12 shows Arun’s badge on side‑door reader, but his badge was reported missing later",
        "held_by": "s4",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "USB forensic report: device ID matches the encrypted drive Arun purchased last month",
        "held_by": "s1",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "Maya’s call log shows a 10 pm call to a cake shop, explaining her ‘vendor’ call",
        "held_by": "s2",
        "points_to": "s1",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "Sneha’s expense sheet lists a Rs 2.3 lakh purchase of a ‘consultancy fee’ to a shell company linked to Arun",
        "held_by": "s4",
        "points_to": "s2",
        "is_red_herring": true
      }
    ],
    "alibi_hole": "Badge swipe at 21:12 proves Arun was in the building after he claimed to have left at 21:30",
    "culprit_objective": "Convince everyone the USB was a company backup drive left for maintenance",
    "ending_caught": "When investigators pieced together the admin log, CCTV badge swipe, and the USB forensic match, they traced the stolen repository straight to Arun’s personal encrypted drive. Confronted, he tried to claim the drive was a routine backup, but the timestamps and his missing badge shattered the lie. He was arrested at his home that night, the rival investor’s offer rescinded.",
    "ending_escaped": "If the badge swipe had been missed, Arun’s alibi of a family dinner would have held. He could have slipped the USB out, feigned a backup, and vanished with the code, leaving NexusAI to scramble for a new demo and lose its Series A round. The missing badge was his only undoing.",
    "roast": "Arun swapped a brilliant architect’s mind for a burglar’s conscience—still can’t design a solid alibi."
  },
  {
    "title": "The Final Cut Heist",
    "setting": "Tollygunge film studio, last day of shooting for a high‑budget period drama. The set includes the main hall, costume warehouse, editing suite, and the on‑site server room.",
    "crime": "The original digital master of the film was replaced with a low‑resolution copy, wiping out weeks of post‑production work.",
    "crime_verb": "replaced the master file with a fake",
    "intro": "The studio was buzzing on the final wrap. When the editor opened the server at 18:45, the 4‑K master was gone, replaced by a grainy proxy. No one saw anyone tamper with the rack, but the loss would cost the producers millions.",
    "suspects": [
      {
        "id": "s1",
        "name": "Arun Basu",
        "role": "Chief Editor",
        "persona": "Meticulous, weary, jargon‑laden",
        "speaking_style": "Technical, precise, often cites frame rates",
        "public_alibi": "Was in the editing suite reviewing color grades from 17:30‑18:20",
        "innocent_secret": "Had an unpaid loan from a rival production house"
      },
      {
        "id": "s2",
        "name": "Maya Dutta",
        "role": "Costume Supervisor",
        "persona": "Sharp, impatient, practical",
        "speaking_style": "Short sentences, blunt, uses industry slang",
        "public_alibi": "Was in the costume warehouse inventorying props from 17:45‑18:30",
        "innocent_secret": "Was secretly negotiating a freelance gig for the next shoot"
      },
      {
        "id": "s3",
        "name": "Rohit Chatterjee",
        "role": "IT Manager",
        "persona": "Calm, methodical, slightly sarcastic",
        "speaking_style": "Dry humor, often references code versions",
        "public_alibi": "Was fixing a printer in the lobby from 17:50‑18:10",
        "innocent_secret": "Had a side‑project selling pirated VFX plugins"
      },
      {
        "id": "s4",
        "name": "Leena Ghosh",
        "role": "Assistant Director",
        "persona": "Nervous, eager, detail‑oriented",
        "speaking_style": "Polite, repeats directives, frequent “sir”",
        "public_alibi": "Was on set coordinating actors from 17:40‑18:15",
        "innocent_secret": "Was meeting a former lover who works at a rival studio"
      }
    ],
    "culprit_id": "s3",
    "motive": "Earn money by selling the 4‑K master to a streaming rival, then erase evidence",
    "method": "Used his admin access to copy the master to an external SSD, then swapped the file on the server with a low‑res proxy, covering tracks by clearing the audit log",
    "timeline": [
      "17:45 Maya finishes inventory, exits warehouse",
      "17:50 Rohit logs into server for routine backup",
      "18:00 Arun leaves editing suite, walks past server room",
      "18:07 Rohit copies master to SSD, deletes original, uploads proxy",
      "18:12 Leena checks shot list, sees server activity on her phone",
      "18:45 Editor discovers missing master"
    ],
    "clues": [
      {
        "id": "c1",
        "text": "Server log shows admin login at 18:03 from Rohit’s workstation ID",
        "held_by": "s1",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "A fingerprint on the server rack door matches Rohit’s badge",
        "held_by": "s2",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "Network packet capture shows a 500 MB file transfer to an external USB device at 18:06",
        "held_by": "s4",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "A torn receipt for a new costume fabric dated 18:05, found in Maya’s locker",
        "held_by": "s3",
        "points_to": "s2",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "A text message from Leena to her ex about meeting at 18:04, printed from the studio printer",
        "held_by": "s2",
        "points_to": "s4",
        "is_red_herring": true
      }
    ],
    "alibi_hole": "Rohit’s printer‑fix claim is busted by CCTV showing him at the server room at 18:04",
    "culprit_objective": "Convince everyone the server’s audit log auto‑cleared at 18:05 due to a scheduled maintenance",
    "ending_caught": "Rohit thought a quick copy and log wipe would slip past everyone. The admin login, his fingerprint, and the USB transfer sealed his fate. When we cross‑checked the server’s checksum with the backup, the tamper was obvious, and the SSD he tried to pawn was traced back to his desk. He’s under arrest, his side‑project dead.",
    "ending_escaped": "If Rohit had destroyed the external SSD before the raid, the copy would have vanished and the audit‑log claim might have held. Without the physical drive, the only proof would be the log, which he’d already scrubbed. He’d walk out, his secret sale intact.",
    "roast": "Rohit tried to edit his own story, but the only thing he edited was his credibility."
  },
  {
    "title": "The Midnight Leak at Vibe Coders",
    "setting": "AIC Techno hackathon floor, Calcutta AI Club, Kolkata – last hour before submissions, judges' desk, score sheets, prize cheque, Wi‑Fi rack, sponsor's prototype on display",
    "crime": "source code of sponsor's prototype was exfiltrated and posted online",
    "crime_verb": "leaked the prototype code",
    "intro": "The clock ticked toward the final submission deadline. Amid the clatter of keyboards, the prized prototype from TechNova vanished from the secure rack, its code appearing on a public forum minutes later. No one saw a hand, but the digital trail was unmistakable.",
    "suspects": [
      {
        "id": "s1",
        "name": "Arun Basu",
        "role": "Lead Mentor, Calcutta AI Club",
        "persona": "Methodical, precise, speaks in measured technical jargon",
        "speaking_style": "Arun explains every step as if debugging a program, rarely uses slang",
        "public_alibi": "Was reviewing submissions at Mentor Table 3 from 18:45 to 19:05",
        "innocent_secret": "Had a pending job interview with a rival AI startup, kept it hidden to avoid conflict of interest"
      },
      {
        "id": "s2",
        "name": "Maya Ghosh",
        "role": "Logistics Coordinator",
        "persona": "Energetic, pragmatic, uses concise commands",
        "speaking_style": "Maya gives short, action‑oriented directives, often punctuated with \"okay?\"",
        "public_alibi": "Was supervising the catering area from 18:40 to 19:10",
        "innocent_secret": "Owes a significant sum to a loan shark, paying weekly under the table"
      },
      {
        "id": "s3",
        "name": "Rajat Chatterjee",
        "role": "Senior Developer, participating team \"QuantumQuirk\"",
        "persona": "Quiet, analytical, speaks in low‑volume, technical terms",
        "speaking_style": "Rajat answers questions with terse, data‑driven sentences, rarely elaborates",
        "public_alibi": "Was at the judges' desk calibrating his team's demo from 18:50 to 19:12",
        "innocent_secret": "Had been secretly negotiating a freelance contract with TechNova to develop a competing product"
      },
      {
        "id": "s4",
        "name": "Lila Sen",
        "role": "Security Officer, AIC Techno venue",
        "persona": "Authoritative, by‑the‑book, uses formal security language",
        "speaking_style": "Lila reports incidents with exact timestamps and protocol references",
        "public_alibi": "Patrolled the main corridor and logged a checkpoint at 19:00 on the east wing",
        "innocent_secret": "Is a member of a local activist group that opposes corporate sponsorships"
      }
    ],
    "culprit_id": "s3",
    "motive": "Earn a lucrative freelance contract by delivering the prototype code to a competitor",
    "method": "Used his access badge to swipe the Wi‑Fi rack at 19:03, plugged a covert USB‑C dongle into the rack’s console, copied the source, then uploaded via an encrypted VPN before leaving the floor",
    "timeline": [
      "18:45 Arun begins reviewing late submissions",
      "18:50 Rajat moves to judges' desk to test demo",
      "19:00 Lila logs east‑wing checkpoint; Wi‑Fi rack access log shows badge Rajat entry",
      "19:03 Rajat initiates data copy, VPN connection established",
      "19:07 Code appears on public forum, timestamp 19:07:12 UTC",
      "19:12 Rajat returns to his workstation, claims he was debugging",
      "19:15 Investigation team secures scene"
    ],
    "clues": [
      {
        "id": "c1",
        "text": "CCTV frame 19:02 shows Rajat's badge swiping the rack door",
        "held_by": "s1",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "Network log: encrypted VPN tunnel opened from Rajat's laptop MAC 00:1A:2B:3C:4D:5E",
        "held_by": "s2",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "USB‑C dongle serial XJ-900 found in the trash near the judges' desk, fingerprint matches Rajat",
        "held_by": "s4",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "A torn receipt for a coffee purchase at 18:55 under Arun's name",
        "held_by": "s2",
        "points_to": "s1",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "A handwritten note about a meeting with a loan shark, found in Maya's locker",
        "held_by": "s4",
        "points_to": "s2",
        "is_red_herring": true
      }
    ],
    "alibi_hole": "Badge access log shows Rajat entered the Wi‑Fi rack at 19:03, contradicting his claim of being at the judges' desk",
    "culprit_objective": "Convince everyone the VPN outage at 19:04 was a network glitch, not a data exfiltration",
    "ending_caught": "When the forensic team traced the VPN tunnel back to Rajat's MAC, the fingerprint on the discarded dongle sealed his fate. Confronted with the badge swipe and CCTV stills, Rajat could not deny the copy. He was escorted out, his freelance deal collapsed, and the stolen code was recovered from his personal cloud backup.",
    "ending_escaped": "Rajat feigned a sudden power failure, claimed his laptop crashed, and slipped the USB‑C dongle into his bag unnoticed. He left the venue before security could lock the exits, and the encrypted upload continued from a mobile hotspot, vanishing his trail. The prototype code remained online, and he disappeared into the night with a new contract.",
    "roast": "Rajat proved that even a quiet coder can make the loudest mistake—leaving a digital fingerprint bigger than his ego."
  },
  {
    "title": "The Camac Street Heist",
    "setting": "Camac Street jewellery showroom, Kolkata – private viewing 9‑11 pm, 12 Oct 2023",
    "crime": "theft of a 2‑carat sapphire necklace worth ₹4.2 million",
    "crime_verb": "stole the sapphire necklace",
    "intro": "The showroom glittered under soft chandeliers as elite clients examined the latest collection. At 10:27 pm, the display case was found empty, the alarm silent, and the night’s star piece vanished without a trace.",
    "suspects": [
      {
        "id": "s1",
        "name": "Arindam Banerjee",
        "role": "Senior sales manager",
        "persona": "meticulous, corporate‑spoken",
        "speaking_style": "formal and data‑driven",
        "public_alibi": "was on a Zoom call with a European buyer from 9:45‑10:30",
        "innocent_secret": "has been secretly negotiating a job with a rival showroom"
      },
      {
        "id": "s2",
        "name": "Madhuri Dutta",
        "role": "Head of security",
        "persona": "no‑nonsense, terse",
        "speaking_style": "brief, commands only",
        "public_alibi": "checked perimeter cameras from 9:30‑10:15 and logged a patrol at 10:20",
        "innocent_secret": "receives monthly cash gifts from a vendor for preferred lighting contracts"
      },
      {
        "id": "s3",
        "name": "Partha Sen",
        "role": "IT systems administrator",
        "persona": "quiet, technical, prefers brevity",
        "speaking_style": "dry, uses acronyms",
        "public_alibi": "was troubleshooting the server room issue from 9:50‑10:40, witnessed by a junior tech",
        "innocent_secret": "has a gambling debt of ₹3 lakh and was planning a high‑stakes bet"
      },
      {
        "id": "s4",
        "name": "Shreya Ghosh",
        "role": "Creative director",
        "persona": "artistic, expressive, emotive",
        "speaking_style": "florid, uses metaphors",
        "public_alibi": "was in the lounge drafting the next campaign from 9:30‑10:35, colleagues saw her at the coffee machine",
        "innocent_secret": "has been secretly dating a client’s son, a relationship frowned upon by her family"
      }
    ],
    "culprit_id": "s3",
    "motive": "to liquidate the debt before the bookmaker collected",
    "method": "used his admin privileges to disable the case’s motion sensors at 10:12, slipped a replica key into the lock, and exited through the service back‑door, swapping the necklace with a pre‑made replica stored in his locker",
    "timeline": [
      "09:45 Showroom opens for private viewing",
      "10:12 Partha disables motion sensors via backend console",
      "10:22 Madhuri conducts routine camera check, notes nothing abnormal",
      "10:27 Display case found empty; alarm triggers",
      "10:35 Security team seals exits; forensic team called"
    ],
    "clues": [
      {
        "id": "c1",
        "text": "CCTV backup from the server room shows Partha’s badge swiped at 10:11",
        "held_by": "s2",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c2",
        "text": "A fingerprint on the replica key matches Partha’s left thumb",
        "held_by": "s4",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c3",
        "text": "Server logs indicate the motion‑sensor disable command originated from Partha’s workstation IP 10.2.5.23",
        "held_by": "s1",
        "points_to": "s3",
        "is_red_herring": false
      },
      {
        "id": "c4",
        "text": "A torn receipt for a high‑end lock‑pick set found in Madhuri’s locker",
        "held_by": "s3",
        "points_to": "s2",
        "is_red_herring": true
      },
      {
        "id": "c5",
        "text": "A text message from Arindam to a rival showroom about “the big move tomorrow”",
        "held_by": "s2",
        "points_to": "s1",
        "is_red_herring": true
      }
    ],
    "alibi_hole": "Server logs show Partha’s workstation accessed the sensor panel at 10:11, contradicting his claim of being in the server rack area",
    "culprit_objective": "Convince everyone the sensor outage was a spontaneous system glitch unrelated to any person",
    "ending_caught": "Partha Sen thought his admin rights made him invisible. The forensic team reconstructed the exact seconds the motion sensors went dark, matched it to his badge swipe, and the fingerprint on the replica key sealed his fate. Under interrogation he confessed, citing the looming gambling debt as his only motive.",
    "ending_escaped": "Partha had hidden the real necklace in a concealed compartment of his office chair, planning to retrieve it later. He left the showroom under the pretense of checking the network, boarded a cab to Delhi, and the necklace vanished from the evidence room before the police could secure it.",
    "roast": "Partha proved that a quiet IT guy can be loud in the courtroom, especially when his alibi is a server log he can’t delete."
  }
];
