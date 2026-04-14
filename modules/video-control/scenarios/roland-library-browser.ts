import type { Page } from 'playwright';

interface ScenarioMetadata {
  name: string;
  description: string;
  mode: 'harness' | 'device';
  outputTier: 'silent' | 'captioned' | 'scripted';
}

export const metadata: ScenarioMetadata = {
  name: 'roland-library-browser',
  description:
    'Visual demo of the Roland S-330 library browser with tree navigation and selection',
  mode: 'harness',
  outputTier: 'silent',
};

// ---------------------------------------------------------------------------
// Voiceover script (determines all timing)
//
// 1. Title card (5s)
//    "The S-330 editor includes a library browser for organizing
//     patches, samples, and tones."
//    ~14 words => ~5.6s at 150 wpm. 5s title + overlap into step 2.
//
// 2. Tree appears (6s)
//    "The library displays your content as a navigable tree structure."
//    ~10 words => ~4s speech + 2s absorption.
//
// 3. Expand Patches folder (7s)
//    "Expanding a folder reveals its contents -- patches organized
//     into sub-folders."
//    ~10 words => ~4s speech + 3s to watch expand animation.
//
// 4. Select Grand Piano patch (7s)
//    "Selecting an item highlights it in the tree. Here we pick
//     Grand Piano from the Piano patches folder."
//    ~16 words => ~6.4s speech + 0.6s absorption.
//
// 5. Expand Samples > Drums folder (7s)
//    "You can browse through different categories to find the content
//     you need."
//    ~13 words => ~5.2s speech + 1.8s watching.
//
// 6. Select Snare_Tight sample (7s)
//    "The library supports the full S-330 content hierarchy -- patches,
//     tones, and wave samples."
//    ~13 words => ~5.2s speech + 1.8s absorption.
//
// 7. Final hold (5s)
//    Viewer absorbs the end state.
//
// Total: 5 + 6 + 7 + 7 + 7 + 7 + 5 = 44s
// ---------------------------------------------------------------------------

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  children?: ReadonlyArray<TreeNode>;
}

const TREE_DATA: ReadonlyArray<TreeNode> = [
  {
    name: 'Library',
    type: 'folder',
    children: [
      {
        name: 'Patches',
        type: 'folder',
        children: [
          {
            name: 'Piano',
            type: 'folder',
            children: [
              { name: 'Grand Piano.patch', type: 'file' },
              { name: 'Rhodes EP.patch', type: 'file' },
              { name: 'Wurlitzer.patch', type: 'file' },
            ],
          },
          {
            name: 'Strings',
            type: 'folder',
            children: [
              { name: 'Violin Ensemble.patch', type: 'file' },
              { name: 'Cello Section.patch', type: 'file' },
            ],
          },
        ],
      },
      {
        name: 'Samples',
        type: 'folder',
        children: [
          {
            name: 'Piano',
            type: 'folder',
            children: [
              { name: 'Piano_C3.wav', type: 'file' },
              { name: 'Piano_C4.wav', type: 'file' },
              { name: 'Piano_C5.wav', type: 'file' },
            ],
          },
          {
            name: 'Drums',
            type: 'folder',
            children: [
              { name: 'Kick_808.wav', type: 'file' },
              { name: 'Snare_Tight.wav', type: 'file' },
              { name: 'HiHat_Closed.wav', type: 'file' },
            ],
          },
        ],
      },
      {
        name: 'Tones',
        type: 'folder',
        children: [
          { name: 'Analog Pad.tone', type: 'file' },
          { name: 'Brass Stab.tone', type: 'file' },
        ],
      },
    ],
  },
];

export const run = async (page: Page): Promise<void> => {
  // -----------------------------------------------------------------------
  // Step 1: Title card (5s)
  // VO: "The S-330 editor includes a library browser for organizing
  //      patches, samples, and tones."
  // -----------------------------------------------------------------------
  await page.evaluate(() => {
    const body = document.body;
    Object.assign(body.style, {
      margin: '0',
      backgroundColor: '#111827',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '40px',
    });

    const section = document.createElement('div');
    section.id = 'title-section';
    Object.assign(section.style, {
      textAlign: 'center',
      marginBottom: '32px',
    });

    const title = document.createElement('h1');
    title.textContent = 'Roland S-330 Editor';
    Object.assign(title.style, {
      color: '#ffffff',
      fontSize: '1.5rem',
      margin: '0 0 8px 0',
    });

    const subtitle = document.createElement('h2');
    subtitle.textContent = 'Sample Library Browser';
    Object.assign(subtitle.style, {
      color: '#9ca3af',
      fontSize: '1rem',
      margin: '0',
      fontWeight: '400',
    });

    section.appendChild(title);
    section.appendChild(subtitle);
    body.appendChild(section);
  });
  await page.waitForTimeout(5000);

  // -----------------------------------------------------------------------
  // Step 2: Build library tree (6s)
  // VO: "The library displays your content as a navigable tree structure."
  // -----------------------------------------------------------------------
  await page.evaluate((treeData: ReadonlyArray<TreeNode>) => {
    const INDENT_PX = 20;
    const container = document.createElement('div');
    container.id = 'library-tree';
    Object.assign(container.style, {
      width: '420px',
      background: 'rgba(17, 24, 39, 0.7)',
      border: '1px solid #374151',
      borderRadius: '6px',
      padding: '12px 0',
      margin: '0 auto',
      overflow: 'hidden',
    });

    let selectedRow: HTMLDivElement | null = null;

    const selectRow = (row: HTMLDivElement): void => {
      if (selectedRow) {
        Object.assign(selectedRow.style, {
          backgroundColor: 'transparent',
        });
        const prevLabel = selectedRow.querySelector(
          '[data-role="label"]',
        ) as HTMLSpanElement | null;
        if (prevLabel) {
          prevLabel.style.color = selectedRow.hasAttribute('data-folder')
            ? '#d1d5db'
            : '#9ca3af';
        }
      }
      selectedRow = row;
      Object.assign(row.style, {
        backgroundColor: '#1e3a5f',
      });
      const label = row.querySelector(
        '[data-role="label"]',
      ) as HTMLSpanElement | null;
      if (label) {
        label.style.color = '#93c5fd';
      }
    };

    const buildTree = (
      nodes: ReadonlyArray<TreeNode>,
      parent: HTMLElement,
      depth: number,
      pathPrefix: string,
    ): void => {
      nodes.forEach((node) => {
        const path = pathPrefix
          ? `${pathPrefix}/${node.name}`
          : node.name;

        const row = document.createElement('div');
        row.setAttribute('data-path', path);
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          padding: '4px 12px',
          paddingLeft: `${12 + depth * INDENT_PX}px`,
          cursor: 'pointer',
          fontSize: '13px',
          lineHeight: '1.6',
          userSelect: 'none',
        });

        row.addEventListener('mouseenter', () => {
          if (row !== selectedRow) {
            row.style.backgroundColor = 'rgba(55, 65, 81, 0.4)';
          }
        });
        row.addEventListener('mouseleave', () => {
          if (row !== selectedRow) {
            row.style.backgroundColor = 'transparent';
          }
        });

        if (node.type === 'folder') {
          row.setAttribute('data-folder', 'true');
          row.setAttribute('data-expanded', 'false');

          const arrow = document.createElement('span');
          arrow.setAttribute('data-role', 'arrow');
          arrow.textContent = '\u25B8'; // collapsed arrow
          Object.assign(arrow.style, {
            marginRight: '6px',
            color: '#6b7280',
            fontSize: '12px',
            width: '12px',
            display: 'inline-block',
            textAlign: 'center',
          });

          const label = document.createElement('span');
          label.setAttribute('data-role', 'label');
          label.textContent = node.name;
          Object.assign(label.style, { color: '#d1d5db' });

          row.appendChild(arrow);
          row.appendChild(label);
          parent.appendChild(row);

          // Children container (hidden initially)
          const childrenContainer = document.createElement('div');
          childrenContainer.setAttribute('data-children-of', path);
          childrenContainer.style.display = 'none';
          parent.appendChild(childrenContainer);

          if (node.children) {
            buildTree(node.children, childrenContainer, depth + 1, path);
          }

          // Click toggles expand/collapse
          row.addEventListener('click', () => {
            const expanded = row.getAttribute('data-expanded') === 'true';
            row.setAttribute('data-expanded', String(!expanded));
            arrow.textContent = expanded ? '\u25B8' : '\u25BE';
            childrenContainer.style.display = expanded ? 'none' : 'block';
            selectRow(row);
          });
        } else {
          // File node
          const spacer = document.createElement('span');
          Object.assign(spacer.style, {
            marginRight: '6px',
            width: '12px',
            display: 'inline-block',
          });
          spacer.textContent = ' ';

          const label = document.createElement('span');
          label.setAttribute('data-role', 'label');
          label.textContent = node.name;
          Object.assign(label.style, { color: '#9ca3af' });

          row.appendChild(spacer);
          row.appendChild(label);
          parent.appendChild(row);

          row.addEventListener('click', () => {
            selectRow(row);
          });
        }
      });
    };

    buildTree(treeData, container, 0, '');

    // Auto-expand root "Library" folder so tree is visible on load
    const libraryRow = container.querySelector(
      '[data-path="Library"]',
    ) as HTMLDivElement | null;
    if (libraryRow) {
      libraryRow.setAttribute('data-expanded', 'true');
      const arrow = libraryRow.querySelector(
        '[data-role="arrow"]',
      ) as HTMLSpanElement | null;
      if (arrow) arrow.textContent = '\u25BE';
      const children = container.querySelector(
        '[data-children-of="Library"]',
      ) as HTMLDivElement | null;
      if (children) children.style.display = 'block';
    }

    document.body.appendChild(container);
  }, [...TREE_DATA]);
  await page.waitForTimeout(6000);

  // -----------------------------------------------------------------------
  // Step 3: Expand Patches folder (7s)
  // VO: "Expanding a folder reveals its contents -- patches organized
  //      into sub-folders."
  // -----------------------------------------------------------------------
  await page.locator('[data-path="Library/Patches"]').click();
  await page.waitForTimeout(2000);

  // Expand Piano sub-folder
  await page.locator('[data-path="Library/Patches/Piano"]').click();
  await page.waitForTimeout(5000);

  // -----------------------------------------------------------------------
  // Step 4: Select Grand Piano patch (7s)
  // VO: "Selecting an item highlights it in the tree. Here we pick
  //      Grand Piano from the Piano patches folder."
  // -----------------------------------------------------------------------
  await page.locator(
    '[data-path="Library/Patches/Piano/Grand Piano.patch"]',
  ).click();
  await page.waitForTimeout(7000);

  // -----------------------------------------------------------------------
  // Step 5: Expand Samples > Drums folder (7s)
  // VO: "You can browse through different categories to find the content
  //      you need."
  // -----------------------------------------------------------------------
  await page.locator('[data-path="Library/Samples"]').click();
  await page.waitForTimeout(2000);

  await page.locator('[data-path="Library/Samples/Drums"]').click();
  await page.waitForTimeout(5000);

  // -----------------------------------------------------------------------
  // Step 6: Select Snare_Tight sample (7s)
  // VO: "The library supports the full S-330 content hierarchy -- patches,
  //      tones, and wave samples."
  // -----------------------------------------------------------------------
  await page.locator(
    '[data-path="Library/Samples/Drums/Snare_Tight.wav"]',
  ).click();
  await page.waitForTimeout(7000);

  // -----------------------------------------------------------------------
  // Step 7: Final hold (5s)
  // Viewer absorbs the end state.
  // -----------------------------------------------------------------------
  await page.waitForTimeout(5000);
};
