export async function templatesCommand(): Promise<void> {
  console.log("Available overlay templates:\n");

  const templates = [
    {
      name: "title",
      description: "Centered title text with optional subtitle",
      properties: [
        "text (required): Main title text",
        "subtitle: Optional subtitle below title",
        "fontSize: Font size in pixels (default: 120)",
        "color: Text color (default: theme.text)",
        "transition: Entry/exit animation",
      ],
    },
    {
      name: "lower-third",
      description: "Name/title bar positioned at bottom of screen",
      properties: [
        "text (required): Primary name or title",
        "subtitle: Secondary text (role, description)",
        "position: bottom-left, bottom-right (default: bottom-left)",
        "fontSize: Font size in pixels (default: 32)",
        "backgroundColor: Background color (default: theme.secondary)",
        "transition: Entry/exit animation (default: slide-up/slide-down)",
      ],
    },
    {
      name: "callout",
      description: "Positioned label with optional arrow pointing to target",
      properties: [
        "text (required): Label text",
        "position: [x, y] pixel coordinates (required)",
        "arrow: true/false - show arrow (default: false)",
        "arrow_target: [x, y] pixel coordinates for arrow endpoint",
        "fontSize: Font size in pixels (default: 24)",
        "backgroundColor: Background color (default: theme.secondary)",
      ],
    },
    {
      name: "code",
      description: "Syntax-highlighted code block",
      properties: [
        "text (required): Code content",
        "syntax: Language for highlighting (default: typescript)",
        "theme: Shiki theme name (default: github-dark)",
        "showLineNumbers: true/false (default: true)",
        "position: Position preset or [x, y] coordinates",
        "fontSize: Font size in pixels (default: 18)",
      ],
    },
    {
      name: "parameter",
      description: "Key-value-unit display for showing measurements or settings",
      properties: [
        "label (required): Parameter name",
        "value (required): Parameter value",
        "unit: Unit of measurement (e.g., dB, ms, Hz)",
        "position: Position preset or [x, y] coordinates",
        "fontSize: Font size in pixels (default: 36)",
        "backgroundColor: Background color (default: theme.secondary)",
      ],
    },
  ];

  templates.forEach((template) => {
    console.log(`📦 ${template.name}`);
    console.log(`   ${template.description}\n`);
    console.log("   Properties:");
    template.properties.forEach((prop) => {
      console.log(`     • ${prop}`);
    });
    console.log("");
  });

  console.log("Common properties (all templates):");
  console.log("  • id: Unique identifier for the overlay");
  console.log("  • in: Start timecode (MM:SS.mmm, SS.mmm, or frame number)");
  console.log("  • out: End timecode");
  console.log("  • transition.in: Entry animation (cut, fade, slide-*, typewriter)");
  console.log("  • transition.out: Exit animation");
  console.log("  • transition.duration: Animation duration in seconds");
  console.log("  • font: Custom font family");
  console.log("  • color: Text color override");
}
