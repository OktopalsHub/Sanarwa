import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const MESSAGE_CHANNELS = [
  "all",
  "email",
  "sms",
  "whatsapp",
  "push",
  "in_app",
  "voice",
] as const;
export const MESSAGE_STATUSES = [
  "all",
  "queued",
  "sent",
  "delivered",
  "failed",
  "cancelled",
] as const;

interface MessageFiltersProps {
  q: string;
  channel: string;
  status: string;
  projectId: string;
  projects: Array<{ id: string; name: string }>;
  onSearch: (value: string) => void;
  onChannel: (value: string) => void;
  onStatus: (value: string) => void;
  onProject: (value: string) => void;
}

export function MessageFilters({
  q,
  channel,
  status,
  projectId,
  projects,
  onSearch,
  onChannel,
  onStatus,
  onProject,
}: MessageFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <Input
        placeholder="Search recipient or tracking id"
        value={q}
        onChange={(event) => onSearch(event.target.value)}
        className="md:max-w-sm"
      />
      <Select value={channel} onValueChange={onChannel}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          {MESSAGE_CHANNELS.map((item) => (
            <SelectItem key={item} value={item}>
              {item === "all" ? "All channels" : item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {MESSAGE_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {item === "all" ? "All statuses" : item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={projectId} onValueChange={onProject}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
