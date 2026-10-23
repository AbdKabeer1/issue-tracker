import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import { auth } from '@/auth';
import Homepage from '@/components/homepage/homepage';
import '@/components/homepage/homepage.css';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-dm-sans' });
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'Ziki Issues',
  description: 'Move every issue forward with your agents. Permissioned, attributable collaboration with people in control.',
};

export default async function Page() {
  const session = await auth();
  return <div className={dmSans.variable + ' ' + manrope.variable}><Homepage signedIn={Boolean(session?.user)} /></div>;
}
