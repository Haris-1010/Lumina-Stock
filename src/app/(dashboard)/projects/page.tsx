import { requireOrganization } from "@/lib/auth";
import { getProjectsForCurrentOrganization, getProjectStats } from "@/lib/actions/projects";
import { ProjectsClient } from "@/components/projects/projects-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  let projects: any[] = [];
  let stats = { total: 0, planning: 0, inProgress: 0, completed: 0, onHold: 0 };
  let canEdit = false;

  try {
    const profile = await getCurrentUserWithPermissions();
    canEdit = Boolean(profile?.permissions.actions.projectsManage);
  } catch {
    canEdit = false;
  }

  try {
    const [projectData, projectStats] = await Promise.all([
      getProjectsForCurrentOrganization(),
      getProjectStats(org.id),
    ]);
    projects = projectData;
    stats = projectStats;
  } catch {
    // Construction tables may not exist in production DB yet
    projects = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Projects</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track construction projects, budgets, and progress.
          </p>
        </div>
        <PageHelp
          title="Projects Guide"
          purpose="Projects tracks your construction or business projects from planning through completion. Monitor budgets vs actual costs and link expenses and contractor work orders."
          sections={[
            {
              title: "How to use",
              items: [
                "Create projects with estimated budgets and target dates.",
                "Track project status: Planning, In Progress, On Hold, Completed.",
                "Link expenses and work orders to projects.",
                "Compare estimated budget vs actual cost.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Real-time budget tracking prevents cost overruns.",
                "Centralized project view with linked expenses.",
                "Status tracking keeps projects on schedule.",
              ],
            },
          ]}
          aiTips={[
            "Which projects are over budget?",
            "How many projects are currently in progress?",
            "What is the total estimated budget across all projects?",
          ]}
        />
      </div>

      <ProjectsClient
        initialProjects={projects}
        stats={stats}
        currencyCode={org.currencyCode}
        canEdit={canEdit}
      />
    </div>
  );
}
