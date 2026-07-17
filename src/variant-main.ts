import './variants/variants.css';
import { VARIANTS, VARIANT_LIST, resolveVariantId } from './variants';
import { bootVariant } from './variants/shell';

bootVariant(VARIANTS[resolveVariantId()], VARIANT_LIST);
