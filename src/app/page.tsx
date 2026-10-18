import dynamic from 'next/dynamic';
import { SanctuaryGateway } from '@/components/gateway/SanctuaryGateway';
import { TopSanctuaryBar } from '@/components/hud/TopSanctuaryBar';
import { GoalCaptureModal } from '@/components/capture/GoalCaptureModal';
import { ReplanDrawer } from '@/components/replan/ReplanDrawer';
import { ExperienceLabDrawer } from '@/components/hud/ExperienceLabDrawer';

const FocusWorldCanvas = dynamic(
  () => import('@/components/world/FocusWorldCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1c120a] text-[#fdf8ee]">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold text-[#fde68a]">
            Loading Project Oakvale...
          </p>
          <p className="mt-2 text-xs text-[#cbb698]">
            Assembling 3D living sanctuary, river boundary & artisan workshops
          </p>
        </div>
      </div>
    )
  }
);

export default function HomePage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#1c120a]">
      <FocusWorldCanvas />
      <SanctuaryGateway />
      <TopSanctuaryBar />
      <GoalCaptureModal />
      <ReplanDrawer />
      <ExperienceLabDrawer />
    </main>
  );
}
