export enum AnnotatorTypes {
  PEAK_DETECTION = "peak_detection",
  CHANGE_POINT_DETECTION = "change_point_detection",
  JUMP_DETECTION = "jump_detection",
  OUTLIER_DETECTION = "outlier_detection",
  PROFILE_2D_THRESHOLD = "profile_2d_threshold",
}

export const annotatorCreatedBy = (type: AnnotatorTypes) =>
  `annotators::${type}`;

export const modelCreatedBy = (modelType: string) => `model::${modelType}`;

const USER_ID_PATTERN = /^[0-9a-f]{24}$/;

// Display only; the raw created_by value is kept for ownership checks, filtering, etc.
export const displayCreatedBy = ({
  created_by,
  created_by_name,
}: {
  created_by: string;
  created_by_name?: string | null;
}) => {
  if (created_by_name) return created_by_name;
  if (USER_ID_PATTERN.test(created_by)) return "Deleted user";
  return created_by.replace(/^(model|annotators)::/, "");
};
