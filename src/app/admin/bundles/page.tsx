import BundlesClient from './BundlesClient';
import { activeModelLabel } from '@/lib/ai/active-model';

// Server wrapper: reads the active provider's model label (env) and passes it
// to the client admin UI so the re-run pipeline view always shows the model
// that actually runs (tracks AI_PROVIDER).
export default function Page() {
  return <BundlesClient modelLabel={activeModelLabel()} />;
}
