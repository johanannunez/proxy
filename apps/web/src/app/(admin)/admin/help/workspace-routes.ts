export type WorkspaceRoute = { path: string; label: string };
export type WorkspaceRouteGroup = { label: string; routes: WorkspaceRoute[] };

export const WORKSPACE_ROUTE_GROUPS: WorkspaceRouteGroup[] = [
  {
    label: "Main Workspace",
    routes: [
      { path: "/workspace/home", label: "Home" },
      { path: "/workspace/properties", label: "Properties" },
      { path: "/workspace/finances", label: "Finances" },
      { path: "/workspace/documents", label: "Documents" },
      { path: "/workspace/calendar", label: "Calendar" },
      { path: "/workspace/inbox", label: "Inbox" },
      { path: "/workspace/tasks", label: "Tasks" },
      { path: "/workspace/timeline", label: "Timeline" },
      { path: "/workspace/meetings", label: "Meetings" },
      { path: "/workspace/team", label: "Team" },
      { path: "/workspace/account", label: "Account" },
      { path: "/workspace/notifications", label: "Notifications" },
      { path: "/workspace/reserve", label: "Reserve" },
      { path: "/workspace/cleaning-checklist", label: "Cleaning Checklist" },
      { path: "/workspace/hospitable", label: "Hospitable" },
    ],
  },
  {
    label: "Setup",
    routes: [
      { path: "/workspace/setup/welcome", label: "Welcome" },
      { path: "/workspace/setup/basics", label: "Basics" },
      { path: "/workspace/setup/address", label: "Address" },
      { path: "/workspace/setup/space", label: "Space" },
      { path: "/workspace/setup/amenities", label: "Amenities" },
      { path: "/workspace/setup/photos", label: "Photos" },
      { path: "/workspace/setup/rules", label: "Rules" },
      { path: "/workspace/setup/wifi", label: "WiFi" },
      { path: "/workspace/setup/cleaning", label: "Cleaning" },
      { path: "/workspace/setup/financial", label: "Financial" },
      { path: "/workspace/setup/payout", label: "Payout" },
      { path: "/workspace/setup/identity", label: "Identity" },
      { path: "/workspace/setup/w9", label: "W-9" },
      { path: "/workspace/setup/compliance", label: "Compliance" },
      { path: "/workspace/setup/host-agreement", label: "Host Agreement" },
      { path: "/workspace/setup/account", label: "Account Setup" },
      { path: "/workspace/setup/recommendations", label: "Recommendations" },
      { path: "/workspace/setup/review", label: "Review" },
    ],
  },
  {
    label: "Onboarding",
    routes: [
      { path: "/workspace/onboarding/property", label: "Property Onboarding" },
      { path: "/workspace/onboarding/complete", label: "Onboarding Complete" },
    ],
  },
];

export const ALL_WORKSPACE_ROUTES = WORKSPACE_ROUTE_GROUPS.flatMap((g) => g.routes);
