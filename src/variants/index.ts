import type { VariantDef, VariantId } from './types';
import { pulse, ember, terrace, loom, hypha } from './meta';
import { createPulse } from './pulse/app';
import { createEmber } from './ember/app';
import { createTerrace } from './terrace/app';
import { createLoom } from './loom/app';
import { createHypha } from './hypha/app';

export type { VariantDef, VariantId, VariantMeta } from './types';
export { VARIANT_LIST, resolveVariantId } from './meta';

export const VARIANTS: Record<VariantId, VariantDef> = {
  pulse: { meta: pulse, create: createPulse },
  ember: { meta: ember, create: createEmber },
  terrace: { meta: terrace, create: createTerrace },
  loom: { meta: loom, create: createLoom },
  hypha: { meta: hypha, create: createHypha },
};
