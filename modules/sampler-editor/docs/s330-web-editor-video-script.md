# S-330 Web Editor — Video Script

**Total runtime:** ~4:30 (including intro card and end card)

---

## INTRO CARD | Before 00:00

**[On screen: Title card / S-330 beauty shot or logo]**

> "The Roland S-330 is a 12-bit sampler from 1987. It sounds gorgeous—crunchy, warm, unmistakably... 80s. But there's a reason these machines get overlooked: without a dedicated CRT monitor and a rare Roland mouse or RC-100 remote, the S-330 is basically unusable. The front panel alone just doesn't cut it."

> "Compare that to an Akai S-series sampler, which you can operate right from the front panel, no extras needed. So a lot of S-330s end up sitting in closets."

> "I built this editor because I wanted to actually use mine. And I wanted to make it available for anyone else in the same situation."

> "It's a free web app—nothing to install. It uses WebMIDI to talk directly to your sampler. There's no cloud service, no account, no subscription. You just load the page, connect your MIDI interface, and start working."

---

## Getting Started

**[On screen: Browser navigating to audiocontrol.org, then to S-330 editor page]**

> "The first thing you do is visit audiocontrol.org and go to the Roland S-330 editor. Once you're there, you might need to give the app permission to use WebMIDI. Then it's time to get connected—make sure the sampler is listening for MIDI system exclusive messages, and tell the app which MIDI input and output ports to use."

---

## 00:00–00:07 | Connect

**[On screen: MIDI port selection in web UI]**

> "So, select your MIDI ports..."

---

## 00:08–00:12 | Video Capture

**[On screen: Video capture window opens, showing S-330's display]**

> "...and if you have a cheap USB capture device, you can see the S-330's display right here in the browser."

---

## 00:13–00:24 | Enable SysEx on Device

**[On screen: Navigating to MIDI mode, then to Exclusive parameter]**

> "On the sampler, enable the Exclusive parameter in MIDI mode. That's what lets the editor talk to the hardware."

---

## 00:25–00:31 | Connect Button

**[On screen: Clicking Connect, connection established]**

> "Click Connect—and now we have two-way communication."

---

## 00:32–00:43 | Virtual Front Panel

**[On screen: Virtual front panel controlling the S-330]**

> "Below the screen capture display, there's also a virtual front panel sends the same SysEx messages as the S-330's physical buttons: Mode, Menu, Sub, Com, Exec, arrow buttons, increment and decrement buttons—the virtual control panel works for almost every screen on the sampler UI (a few, like the Ssmpling screen, don't respond to SysEx messages, so you have to use the front panel buttons for that)"

*(00:40–00:43: keyboard shortcuts)*

> "Each button has a keyboard shortcuts, so you can use F1-F5 for the menu buttons, arrow keys for navigation, plus/minus for value changes..."

---

## 00:44–00:57 | TourBox Controller

**[On screen: TourBox controlling filter sweep, music playing]**

> "You can also use a controller, if you have one. I've mapped mine to a TourBox—data wheel, quick-access buttons. It's like having the RC-100 remote controller, except, you know, modern and accessible."

**[Let the filter sweep and music play—no narration for a few seconds]**

---

## 00:58–01:03 | Play Page

**[On screen: Play page showing 8 MIDI parts]**

> "The Play page shows the eight parts multi-timbral assignments: channels, patches, levels, outputs. The first bank of patches and tones load automatically from the device."

---

## 01:04–01:28 | Patches Editor

**[On screen: Patches editor, editing name and level]**

> "Moving to the patches, editor, you can easily rename patches without that painful front-panel character entry..."

*(01:13: adjusting level slider)*

> "...and adjust levels while you listen. The editor sends updates when you release the control, so the sampler doesn't get overwhelmed."

*(brief pause)*

> "Panic button if you get a stuck note."

---

## 01:29–02:20 | Tone Mapping / Zones

**[On screen: Tone mapping expanded, assigning samples to zones]**

> "Tone mapping lets you spread samples across the keyboard however you want—chromatic ranges for melodic parts, single keys for multi-samples, drums or sample chops."

**[02:00–02:20: Playing different samples—let the audio demonstrate]**

*(No narration—just the demo)*

---

## 02:21–02:47 | Tones Editor

**[On screen: Tones editor with filter, LFO, envelope controls]**

> "The Tones editor puts filter, LFO, and envelopes all on one page—no hopping back and forth across multiple pages."

**[Filter adjustments with audio]**

*(Light narration or silence—let it play)*

---

## 02:48–03:13 | Envelope & LFO Editing (2x speed)

**[On screen: Sped-up editing of envelopes and LFO]**

> "Here's some envelope and LFO tweaking at double speed. The point is: you can actually shape sounds relatively quickly."

---

## 03:14 | Fade to Black

*(No narration)*

---

## 03:15–04:14 | Audio Comparison

**[On screen: DAW playing drum loop variations]**

**[On-screen titles for each variation—no voiceover]**

- 03:15 — Original
- 03:20 — 30kHz
- 03:25 — 45 RPM -> 30kHz -> pitched down
- 03:30 — 15kHz
- 03:35 — 2x speed -> 30kHz -> pitched down
- 03:40 — 2x speed -> 30kHz -> filtered to 7k
- 03:45–04:14 — Repeat (no titles, just listen)

*(No narration for this entire section)*

---

## 04:15+ | End Card

**[On screen: URL, GitHub link, CTA]**

> "So that's the S-330 Web Editor. A virtual front panel with keyboard shortcuts. Easy patch and tone naming. Tone mapping across the keyboard. Filter, LFO, and envelopes all on one page."

> "No CRT, no Roland mouse, no RC-100—just a browser and a MIDI interface. If you've got an S-330 collecting dust, maybe it's time to put it back to work."

> "Try it at audiocontrol.org/s330. Source is on GitHub, link in the description—feedback welcome, contributions too if you're feeling ambitious. Thanks for watching."

---

## Recording Notes

- **Intro:** This is the "why should I care" moment. Personal and direct—you built it to solve your own problem.
- **00:44–00:57:** The accessibility point lands here. It's not about saving money; it's about making the sampler actually usable with gear you can find.
- **03:15–04:14:** Titles only, no VO. Let the crunch sell itself.
- **End card:** Keep it brief. You've made the case; just tell them where to go.
