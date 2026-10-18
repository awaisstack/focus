export type TaskCategory =
  | 'STUDY'
  | 'WRITING'
  | 'OUTDOORS'
  | 'CONNECTION'
  | 'GENERAL'
  | 'SCHOLAR_TOWER'
  | 'GUILD_WORKSHOP'
  | 'MEADOW_PAVILION'
  | 'MARKET_HEARTH'
  | 'MILL_GRANARY'
  | 'APOTHECARY_COTTAGE';

export type TaskStatus =
  | 'proposed'
  | 'pending'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'deferred'
  | 'cancelled';

export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export type ScheduleRationaleCode =
  | 'HARD_DEADLINE_FIRST'
  | 'FIXED_APPOINTMENT'
  | 'PREREQUISITE_FOR_OTHER'
  | 'HIGHEST_PRIORITY_FIT'
  | 'FITS_REMAINING_WINDOW'
  | 'USER_MANUAL_ORDER';

export type DeferralReasonCode =
  | 'INSUFFICIENT_REMAINING_TIME'
  | 'DEPENDENCY_DEFERRED'
  | 'FIXED_SLOT_CONFLICT'
  | 'EXCEEDS_DAILY_BUDGET'
  | 'USER_DEFERRED';

export interface FixedTimeSlot {
  startMinuteOffset: number;
  endMinuteOffset: number;
  label?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  isDurationConfirmed: boolean;
  priority: TaskPriority;
  dependencies: string[];
  fixedSlot?: FixedTimeSlot;
  hardDeadlineOffsetMinutes?: number;
  category: TaskCategory;
  status: TaskStatus;
  rationaleCode?: ScheduleRationaleCode;
  rationaleText?: string;
  deferralCode?: DeferralReasonCode;
  deferralText?: string;
  scheduledStartOffset?: number;
  scheduledEndOffset?: number;
  source: 'user' | 'ai-proposal' | 'demo-preset';
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSlot {
  taskId: string;
  startMinuteOffset: number;
  endMinuteOffset: number;
  bufferMinutesAfter: number;
  rationaleCode: ScheduleRationaleCode;
  rationaleText: string;
}

export interface PlanDiffItem {
  taskId: string;
  title: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  estimatedMinutes: number;
  explanation: string;
}

export interface PlanSnapshot {
  snapshotId: string;
  timestamp: string;
  availableMinutes: number;
  tasks: TaskItem[];
  summaryNote: string;
}
