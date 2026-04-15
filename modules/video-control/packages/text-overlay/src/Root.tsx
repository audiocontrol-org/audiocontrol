import { Composition } from "remotion";
import { OverlayComposition } from "@/composition/OverlayComposition";
import type { ParsedProject } from "@/parser/parse";
import { calculateDurationFromOverlays } from "@/utils/timing";

// Sample project for Remotion Studio preview
const sampleProject: ParsedProject = {
  project: {
    name: "Sample Overlay Demo",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300, // 10 seconds
  },
  defaults: {
    font: "Inter",
  },
  theme: {
    primary: "#3B82F6",
    secondary: "#1E293B",
    text: "#F8FAFC",
    accent: "#F59E0B",
  },
  overlays: [
    {
      type: "title",
      title: "Welcome to TextOverlay",
      subtitle: "Professional text overlays made easy",
      inFrame: 0,
      outFrame: 90, // 3 seconds
      durationInFrames: 90,
      transitionInFrames: 15,
      transition: { in: "fade", out: "fade", duration: 0.5 },
    },
    {
      type: "lower-third",
      title: "Demo User",
      subtitle: "Content Creator",
      position: "bottom-left",
      inFrame: 100,
      outFrame: 200,
      durationInFrames: 100,
      transitionInFrames: 8,
      transition: { in: "slide-up", out: "slide-down", duration: 0.25 },
    },
    {
      type: "callout",
      title: "Click here!",
      position: [1200, 400],
      arrow: true,
      arrow_target: [980, 350],
      inFrame: 150,
      outFrame: 250,
      durationInFrames: 100,
      transitionInFrames: 8,
    },
    {
      type: "parameter",
      label: "Gain Reduction",
      value: "-6.2",
      unit: "dB",
      position: [100, 100],
      inFrame: 200,
      outFrame: 300,
      durationInFrames: 100,
      transitionInFrames: 8,
    },
  ],
};

interface CompositionProps {
  project: ParsedProject;
}

// Wrapper component that accepts props as 'any' to satisfy Remotion
const OverlayWrapper: React.FC<CompositionProps> = (props) => {
  return <OverlayComposition project={props.project} />;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TextOverlay"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={OverlayWrapper as any}
        durationInFrames={sampleProject.project.durationInFrames}
        fps={sampleProject.project.fps}
        width={sampleProject.project.width}
        height={sampleProject.project.height}
        defaultProps={{ project: sampleProject }}
        calculateMetadata={({ props }) => {
          const { project } = props as CompositionProps;
          const durationInFrames = project.overlays.length > 0
            ? calculateDurationFromOverlays(project.overlays)
            : project.project.durationInFrames;
          return {
            durationInFrames,
            fps: project.project.fps,
            width: project.project.width,
            height: project.project.height,
          };
        }}
      />
    </>
  );
};
