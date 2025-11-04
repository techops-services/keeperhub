'use client';

import { useState, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ArrowUp, Plus } from 'lucide-react';
import { workflowApi } from '@/lib/workflow-api';
import { useSession } from '@/lib/auth-client';
import { toast } from 'sonner';
import {
  vercelProjectsAtom,
  selectedProjectIdAtom,
  showNewProjectDialogAtom,
  newProjectNameAtom,
  creatingProjectAtom,
} from '@/lib/atoms/vercel-projects';

export function WorkflowPrompt() {
  // Local component state (dumb state that doesn't need to persist)
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Jotai atoms (shared state that persists across mounts)
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [vercelProjects, setVercelProjects] = useAtom(vercelProjectsAtom);
  const [showNewProjectDialog, setShowNewProjectDialog] = useAtom(showNewProjectDialogAtom);
  const [newProjectName, setNewProjectName] = useAtom(newProjectNameAtom);
  const [creatingProject, setCreatingProject] = useAtom(creatingProjectAtom);

  const router = useRouter();
  const { data: session } = useSession();

  // Load Vercel projects when component mounts
  useEffect(() => {
    if (!session) return;

    const loadVercelProjects = async () => {
      try {
        const response = await fetch('/api/user/vercel-projects');
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded Vercel projects:', data.projects);
          setVercelProjects(data.projects || []);
        } else {
          console.error('Failed to fetch projects, status:', response.status);
        }
      } catch (error) {
        console.error('Failed to load Vercel projects:', error);
      }
    };

    loadVercelProjects();
  }, [session, setVercelProjects]);

  const handleProjectChange = (value: string) => {
    if (value === 'new') {
      setShowNewProjectDialog(true);
    } else {
      setSelectedProjectId(value);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setCreatingProject(true);
    try {
      const response = await fetch('/api/user/vercel-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Created project:', data.project);

        // Update the projects list
        setVercelProjects((prev) => [...prev, data.project]);

        // Select the newly created project
        setSelectedProjectId(data.project.id);
        console.log('Selected project ID set to:', data.project.id);

        // Close dialog and clear form
        setShowNewProjectDialog(false);
        setNewProjectName('');

        toast.success('Project created successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    // Check if user is logged in
    if (!session) {
      // Redirect to login page
      router.push('/login');
      return;
    }

    setIsGenerating(true);
    try {
      // Create empty workflow first
      const newWorkflow = await workflowApi.create({
        name: 'AI Generated Workflow',
        description: `Generated from: ${prompt}`,
        nodes: [],
        edges: [],
        vercelProjectId: selectedProjectId === 'none' ? undefined : selectedProjectId,
      });

      // Store the prompt in sessionStorage for the workflow page to use
      sessionStorage.setItem('ai-prompt', prompt);
      sessionStorage.setItem('generating-workflow-id', newWorkflow.id);

      // Navigate to the new workflow immediately
      router.push(`/workflows/${newWorkflow.id}?generating=true`);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast.error('Failed to create workflow. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
      e.preventDefault();
      if (prompt.trim()) {
        const form = e.currentTarget.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleGenerate}>
        <div className="bg-muted/30 relative cursor-text overflow-hidden rounded-2xl border shadow-sm">
          {/* Textarea */}
          <div className="relative bg-transparent">
            <Textarea
              ref={textareaRef}
              placeholder="Describe your workflow..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              required
              rows={3}
              autoFocus
              className="w-full resize-none border-0 !bg-transparent p-4 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Project Selection and Submit Button */}
          <div className="p-4 pt-0">
            <div className="flex items-center justify-between gap-2">
              {/* Left side: Project Selector */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {session && (
                  <Select
                    value={selectedProjectId}
                    onValueChange={handleProjectChange}
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[180px] shrink-0 border-0 bg-transparent shadow-none focus:ring-0">
                      <SelectValue placeholder="Select project (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {vercelProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new" className="text-primary">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          <span>New Project</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Right side: Submit Button */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="submit"
                  disabled={isGenerating || !prompt.trim()}
                  size="sm"
                  className="h-8 w-8 rounded-full p-0"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Vercel Project</DialogTitle>
            <DialogDescription>
              Create a new local project entry. This will be stored in your database and can be
              linked to workflows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="my-vercel-project"
                disabled={creatingProject}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingProject) {
                    handleCreateProject();
                  }
                }}
              />
              <p className="text-muted-foreground text-xs">
                Enter a descriptive name for your project
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewProjectDialog(false);
                setNewProjectName('');
              }}
              disabled={creatingProject}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
            >
              {creatingProject ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
