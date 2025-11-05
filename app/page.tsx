import type { Metadata } from "next";
import { Canvas } from "@/components/ai-elements/canvas";
import { Panel } from "@/components/ai-elements/panel";
import { Recents } from "@/components/workflows/recents";
import { UserMenu } from "@/components/workflows/user-menu";
import { WorkflowIndexPrompt } from "@/components/workflows/workflow-index-prompt";

export const metadata: Metadata = {
  title: "Home | Workflow Builder",
  description:
    "Create a new workflow or continue working on your existing workflows.",
};

const Home = () => (
  <div className="fixed top-0 left-0 z-0 h-screen w-screen">
    <Canvas>
      <Panel className="rounded-full p-0" position="top-right">
        <UserMenu />
      </Panel>
      <WorkflowIndexPrompt />
      <Panel
        className="w-full max-w-sm border-none bg-transparent p-0"
        position="bottom-center"
      >
        <Recents limit={3} />
      </Panel>
    </Canvas>
  </div>
);

export default Home;
