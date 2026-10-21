export interface Point2 { x: number; z: number }

export interface Collider extends Point2 { halfX: number; halfZ: number }

export interface Landmark extends Point2 {
  id: string;
  name: string;
  kind: 'cafe' | 'home' | 'tower' | 'plaza' | 'water' | 'garden';
  radius: number;
  description: string;
}

/** Positive moveZ means forward; yaw=0 looks north (-Z). */
export interface SimulationInput {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
  yaw: number;
}

/** Character models face +Z at yaw=0. y is height of the feet. */
export interface PlayerState extends Point2 {
  y: number;
  yaw: number;
  speed: number;
  velocityX: number;
  velocityZ: number;
  verticalVelocity: number;
  grounded: boolean;
}

export interface CitizenState extends Point2 {
  id: string;
  yaw: number;
  palette: number;
  routeId?: string;
  speed?: number;
}

export interface SidewalkRoute {
  id: string;
  name: string;
  waypoints: Point2[];
}

export type VehicleKind = 'shuttle' | 'sedan' | 'coupe' | 'van' | 'taxi';

export interface VehicleState extends Point2 {
  id: string;
  yaw: number;
  kind: VehicleKind;
  lane: 'outer' | 'inner' | 'cross-east' | 'cross-west';
  colorIndex: number;
  speed: number;
}

export type BuildingKind =
  | 'bistro'
  | 'cafe'
  | 'apartment'
  | 'tower'
  | 'blendkit-townhouse'
  | 'blendkit-arcade'
  | 'blendkit-conservatory'
  | 'blendkit-pavilion';

export interface BuildingPlacement extends Point2 {
  id: string;
  name: string;
  kind: BuildingKind;
  rotation: number;
  scale: number;
  halfX: number;
  halfZ: number;
  height: number;
  palette?: number;
  blendkitId?: string;
}

export interface RoadSegment {
  id: string;
  x: number;
  z: number;
  length: number;
  width: number;
  orientation: 'horizontal' | 'vertical';
  lanes: 2;
  isBridge?: boolean;
}

export interface BlendKitAssetMeta {
  id: string;
  name: string;
  category: 'Architecture' | 'Vehicles' | 'Vegetation' | 'Street & Props';
  triangles: number;
  instances: number;
  sourceUrl: string;
  license: 'CC0 / Free Commercial';
  description: string;
}

export interface SimulationState {
  player: PlayerState;
  companion: Point2 & { yaw: number };
  time: number;
  paused: boolean;
  discovered: string[];
  nearLandmark: string | null;
  frame: number;
  elapsed: number;
  npcs: CitizenState[];
  shuttle: Point2 & { yaw: number };
  vehicles: VehicleState[];
  /** Input edge state belongs to simulation so keyboard and touch agree. */
  jumpHeld: boolean;
}

