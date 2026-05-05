import { z } from "zod";

export const PlatformSchema = z.enum(["zepto", "swiggy_instamart", "blinkit"]);
export type Platform = z.infer<typeof PlatformSchema>;
