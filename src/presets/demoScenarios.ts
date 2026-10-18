import type { TaskCategory, TaskItem } from '@/types/task';
import type { LandmarkArchetype, LandmarkNode, WorldProfile } from '@/types/world';

export type DemoScenarioId = 'SCENARIO_A_STUDY_DAY' | 'SCENARIO_B_INTERRUPTED_45M';

export interface DemoScenarioBundle {
  id: DemoScenarioId;
  badge: string;
  title: string;
  userPromptText: string;
  interruptionText?: string;
  availableMinutes: number;
  worldSeed: string;
  profile: WorldProfile;
  tasks: TaskItem[];
}

export function categoryToArchetype(category: TaskCategory): LandmarkArchetype {
  switch (category) {
    case 'STUDY':
      return 'STUDY_NOOK';
    case 'WRITING':
      return 'WRITING_PAVILION';
    case 'OUTDOORS':
      return 'WALK_TRAIL_ARCH';
    case 'CONNECTION':
      return 'CONNECT_BENCH';
    default:
      return 'SANCTUARY_GREENHOUSE';
  }
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioBundle> = {
  SCENARIO_A_STUDY_DAY: {
    id: 'SCENARIO_A_STUDY_DAY',
    badge: 'Scenario A • Full Study & Balance Day (210m)',
    title: 'Quiet Study & Restoration Day',
    userPromptText:
      'Study for an hour, finish my assignment, go for a walk, and call my friend.',
    availableMinutes: 210,
    worldSeed: 'focus-sanctuary-seed-2026-alpha',
    profile: {
      biomeId: 'SUNLIT_GLADE',
      soundscapeId: 'MORNING_BREEZE',
      narrativeLine:
        'Early light filters through the moss glade. Begin at the Elevated Study Nook while the morning is clear.',
      atmosphereNote:
        '210 minutes available • 4 destinations connected • 45 minutes unscheduled breathing room',
      sunElevationDeg: 48,
      fogDensity: 0.012
    },
    tasks: [
      {
        id: 'task-study-1h',
        title: 'Study core material for an hour',
        description: 'Review lecture notes and annotate key concepts at the Study Nook.',
        estimatedMinutes: 60,
        isDurationConfirmed: true,
        priority: 5,
        dependencies: [],
        category: 'STUDY',
        status: 'scheduled',
        rationaleCode: 'PREREQUISITE_FOR_OTHER',
        rationaleText: 'Scheduled first because finishing your assignment depends on this study session.',
        scheduledStartOffset: 0,
        scheduledEndOffset: 60,
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      },
      {
        id: 'task-finish-assignment',
        title: 'Finish my assignment draft',
        description: 'Synthesize notes into the final written submission at the Scholar Pavilion.',
        estimatedMinutes: 45,
        isDurationConfirmed: false,
        priority: 5,
        dependencies: ['task-study-1h'],
        hardDeadlineOffsetMinutes: 180,
        category: 'WRITING',
        status: 'scheduled',
        rationaleCode: 'HARD_DEADLINE_FIRST',
        rationaleText: 'Placed immediately after Study to meet today’s assignment deadline.',
        scheduledStartOffset: 65,
        scheduledEndOffset: 110,
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      },
      {
        id: 'task-walk-outdoors',
        title: 'Go for a restorative walk',
        description: 'Step away from screens and follow the pine ridge trail.',
        estimatedMinutes: 30,
        isDurationConfirmed: true,
        priority: 3,
        dependencies: [],
        category: 'OUTDOORS',
        status: 'scheduled',
        rationaleCode: 'HIGHEST_PRIORITY_FIT',
        rationaleText: 'Scheduled after deep cognitive work to restore energy.',
        scheduledStartOffset: 115,
        scheduledEndOffset: 145,
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      },
      {
        id: 'task-call-friend',
        title: 'Call my friend to catch up',
        description: 'Unhurried conversation by the waterside lantern bench.',
        estimatedMinutes: 20,
        isDurationConfirmed: false,
        priority: 3,
        dependencies: [],
        category: 'CONNECTION',
        status: 'scheduled',
        rationaleCode: 'FITS_REMAINING_WINDOW',
        rationaleText: 'Fits comfortably at the close of the route.',
        scheduledStartOffset: 150,
        scheduledEndOffset: 170,
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      }
    ]
  },

  SCENARIO_B_INTERRUPTED_45M: {
    id: 'SCENARIO_B_INTERRUPTED_45M',
    badge: 'Scenario B • Interrupted Day — Only 45m Remain',
    title: 'Calm Replan After Interruption',
    userPromptText:
      'Study for an hour, finish my assignment, go for a walk, and call my friend.',
    interruptionText:
      'Study is done, an unexpected appointment took my afternoon, and I only have 45 minutes left now.',
    availableMinutes: 45,
    worldSeed: 'focus-sanctuary-seed-2026-alpha',
    profile: {
      biomeId: 'MISTY_ZEN_STREAM',
      soundscapeId: 'JADE_RAIN_STREAM',
      narrativeLine:
        'Your completed Study Nook remains in full bloom. With 45 minutes left, the path focuses directly on your assignment.',
      atmosphereNote:
        '45 minutes remaining • 1 completed preserved • 1 active next step (45m) • 2 tasks resting for later',
      sunElevationDeg: 28,
      fogDensity: 0.018
    },
    tasks: [
      {
        id: 'task-study-1h',
        title: 'Study core material for an hour',
        description: 'Review lecture notes and annotate key concepts at the Study Nook.',
        estimatedMinutes: 60,
        isDurationConfirmed: true,
        priority: 5,
        dependencies: [],
        category: 'STUDY',
        status: 'completed',
        rationaleCode: 'PREREQUISITE_FOR_OTHER',
        rationaleText: 'Completed earlier today — preserved in your sanctuary.',
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T11:00:00.000Z'
      },
      {
        id: 'task-finish-assignment',
        title: 'Finish my assignment draft',
        description: 'Synthesize notes into the final written submission at the Scholar Pavilion.',
        estimatedMinutes: 45,
        isDurationConfirmed: false,
        priority: 5,
        dependencies: ['task-study-1h'],
        hardDeadlineOffsetMinutes: 45,
        category: 'WRITING',
        status: 'scheduled',
        rationaleCode: 'FITS_REMAINING_WINDOW',
        rationaleText:
          'Fits your exact 45-minute window and prerequisites are complete.',
        scheduledStartOffset: 0,
        scheduledEndOffset: 45,
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T11:05:00.000Z'
      },
      {
        id: 'task-walk-outdoors',
        title: 'Go for a restorative walk',
        description: 'Step away from screens and follow the pine ridge trail.',
        estimatedMinutes: 30,
        isDurationConfirmed: true,
        priority: 3,
        dependencies: [],
        category: 'OUTDOORS',
        status: 'deferred',
        deferralCode: 'INSUFFICIENT_REMAINING_TIME',
        deferralText:
          'Deferred: requires ~30m, and 0m remain after your high-priority 45m assignment.',
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T11:05:00.000Z'
      },
      {
        id: 'task-call-friend',
        title: 'Call my friend to catch up',
        description: 'Unhurried conversation by the waterside lantern bench.',
        estimatedMinutes: 20,
        isDurationConfirmed: false,
        priority: 3,
        dependencies: [],
        category: 'CONNECTION',
        status: 'deferred',
        deferralCode: 'INSUFFICIENT_REMAINING_TIME',
        deferralText:
          'Deferred: requires ~20m, which no longer fits in today’s remaining 45m budget.',
        source: 'demo-preset',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T11:05:00.000Z'
      }
    ]
  }
};

const FIXED_LANDMARK_SLOTS: Array<{
  position: [number, number, number];
  rotationY: number;
}> = [
  { position: [-5.8, 1.35, 3.6], rotationY: 0.45 },
  { position: [-1.4, 1.85, -3.2], rotationY: -0.25 },
  { position: [5.4, 1.45, -2.4], rotationY: -0.8 },
  { position: [4.8, 0.85, 4.4], rotationY: -1.4 }
];

export function buildLandmarksFromTasks(tasks: TaskItem[]): LandmarkNode[] {
  const firstScheduledTask = tasks.find(
    (t) => t.status === 'scheduled' || t.status === 'in-progress'
  );

  return tasks.map((task, idx) => {
    const slot = FIXED_LANDMARK_SLOTS[idx % FIXED_LANDMARK_SLOTS.length];
    const isCompleted = task.status === 'completed';
    const isDeferred = task.status === 'deferred';
    const isNextStep =
      !isCompleted && !isDeferred && firstScheduledTask?.id === task.id;

    const growthStage = isCompleted ? 2 : isDeferred ? 0 : 1;

    return {
      id: `landmark-${task.id}`,
      taskId: task.id,
      label: task.title,
      subtitle: `${task.estimatedMinutes} min${task.isDurationConfirmed ? '' : ' (est.)'}`,
      category: task.category,
      archetype: categoryToArchetype(task.category),
      position: slot.position,
      rotationY: slot.rotationY,
      scale: 1,
      growthStage,
      isNextStep,
      isCompleted,
      isDeferred,
      estimatedMinutes: task.estimatedMinutes,
      rationaleOrDeferralNote:
        task.status === 'deferred'
          ? task.deferralText || 'Resting for a future window.'
          : task.rationaleText || 'Scheduled in today’s route.'
    };
  });
}
