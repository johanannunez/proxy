"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FolderOpen, GlobeHemisphereWest, LockKey, Plus, Sparkle } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { createProject } from "@/lib/admin/project-actions";
import type { ProjectRow, ProjectType, ProjectVisibility } from "@/lib/admin/project-types";
import {
  CLIENT_PROJECT_TYPES,
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_EMOJI,
  PROJECT_TYPE_LABEL,
  PROJECT_VISIBILITY_LABEL,
} from "@/lib/admin/project-types";
import type { WorkspaceContactProperty, WorkspaceMember } from "@/lib/admin/workspace-contact-detail";
import styles from "./WorkspaceProjectsTab.module.css";

const NO_PROPERTY_VALUE = "__none";

const PROJECT_TYPE_OPTIONS = CLIENT_PROJECT_TYPES.map((type) => ({
  value: type,
  label: `${PROJECT_TYPE_EMOJI[type]} ${PROJECT_TYPE_LABEL[type]}`,
}));

const VISIBILITY_OPTIONS: Array<{ value: ProjectVisibility; label: string }> = [
  { value: "internal", label: PROJECT_VISIBILITY_LABEL.internal },
  { value: "portal_visible", label: PROJECT_VISIBILITY_LABEL.portal_visible },
];

function formatTargetDate(value: string | null): string {
  if (!value) return "No target";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function progress(project: ProjectRow): number {
  if (project.taskCount === 0) return 0;
  return Math.round((project.taskDoneCount / project.taskCount) * 100);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function WorkspaceProjectsTab({
  projects,
  activeContactId,
  activeContactName,
  members,
  properties,
}: {
  projects: ProjectRow[];
  activeContactId: string;
  activeContactName: string;
  members: WorkspaceMember[];
  properties: WorkspaceContactProperty[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("furnishing");
  const [visibility, setVisibility] = useState<ProjectVisibility>("internal");
  const [propertyId, setPropertyId] = useState(NO_PROPERTY_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const propertyOptions = useMemo(
    () => [
      { value: NO_PROPERTY_VALUE, label: "No specific property" },
      ...properties.map((property) => ({
        value: property.id,
        label: property.label,
      })),
    ],
    [properties],
  );

  const primaryProjects = projects.filter((project) => project.linkedContactId === activeContactId);
  const sharedProjects = projects.filter((project) => project.linkedContactId !== activeContactId);

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setError(null);
    startTransition(async () => {
      try {
        await createProject({
          name: trimmedName,
          projectType,
          visibility,
          linkedContactId: activeContactId,
          linkedPropertyId: propertyId === NO_PROPERTY_VALUE ? null : propertyId,
          emoji: PROJECT_TYPE_EMOJI[projectType],
        });
        setName("");
        setProjectType("furnishing");
        setVisibility("internal");
        setPropertyId(NO_PROPERTY_VALUE);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create project.");
      }
    });
  };

  return (
    <div className={styles.root}>
      <section className={styles.createPanel} aria-label="Create workspace project">
        <div className={styles.createIntro}>
          <span className={styles.createIcon} aria-hidden>
            <Sparkle size={16} weight="fill" />
          </span>
          <div>
            <h2 className={styles.createTitle}>Add a workspace project</h2>
            <p className={styles.createText}>
              Use projects for furnishing, renovation, onboarding, launch prep, and vendor coordination.
            </p>
          </div>
        </div>

        <form
          className={styles.createForm}
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <label className={styles.field}>
            <span className={styles.label}>Project name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Furnishing plan for ${firstName(activeContactName)}`}
              disabled={isPending}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <CustomSelect
              value={projectType}
              onChange={(value) => setProjectType(value as ProjectType)}
              options={PROJECT_TYPE_OPTIONS}
              disabled={isPending}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Visibility</span>
            <CustomSelect
              value={visibility}
              onChange={(value) => setVisibility(value as ProjectVisibility)}
              options={VISIBILITY_OPTIONS}
              disabled={isPending}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Property</span>
            <CustomSelect
              value={propertyId}
              onChange={setPropertyId}
              options={propertyOptions}
              disabled={isPending}
            />
          </label>

          <button className={styles.createButton} type="submit" disabled={!name.trim() || isPending}>
            <Plus size={14} weight="bold" />
            {isPending ? "Adding..." : "Add project"}
          </button>
        </form>

        {error ? <div className={styles.error}>{error}</div> : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Projects for {firstName(activeContactName)}</h2>
            <p className={styles.sectionMeta}>
              {members.length > 1
                ? "Person-specific projects appear first. Shared workspace projects stay visible below."
                : "Larger initiatives tied to this workspace."}
            </p>
          </div>
          <span className={styles.countPill}>{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <div className={styles.empty}>
            <FolderOpen size={22} weight="duotone" />
            <div>
              <strong>No projects yet</strong>
              <span>Create one above to organize a larger client initiative.</span>
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {[...primaryProjects, ...sharedProjects].map((project) => (
              <Link key={project.id} href={`/admin/projects/${project.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.projectIcon}>{project.emoji ?? PROJECT_TYPE_EMOJI[project.projectType]}</span>
                  <div className={styles.projectTitleBlock}>
                    <h3 className={styles.projectName}>{project.name}</h3>
                    <p className={styles.projectSub}>
                      {PROJECT_TYPE_LABEL[project.projectType]}
                      {project.linkedPropertyName ? ` · ${project.linkedPropertyName}` : ""}
                    </p>
                  </div>
                  <span className={`${styles.visibilityPill} ${project.visibility === "portal_visible" ? styles.visible : ""}`}>
                    {project.visibility === "portal_visible" ? (
                      <GlobeHemisphereWest size={11} weight="bold" />
                    ) : (
                      <LockKey size={11} weight="bold" />
                    )}
                    {PROJECT_VISIBILITY_LABEL[project.visibility]}
                  </span>
                </div>

                <div className={styles.progressRow}>
                  <span>{project.taskDoneCount} of {project.taskCount} tasks</span>
                  <span>{progress(project)}%</span>
                </div>
                <div className={styles.progressBar}>
                  <span style={{ width: `${progress(project)}%` }} />
                </div>

                <div className={styles.cardFooter}>
                  <span className={`${styles.statusPill} ${styles[`status_${project.status}`]}`}>
                    {PROJECT_STATUS_LABEL[project.status]}
                  </span>
                  <span>{formatTargetDate(project.targetDate)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
