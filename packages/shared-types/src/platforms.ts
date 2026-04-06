import { z } from "zod";

export const PlatformSchema = z.enum(["zepto", "swiggy_instamart"]);
export type Platform = z.infer<typeof PlatformSchema>;
