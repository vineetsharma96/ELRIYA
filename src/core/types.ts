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
  /** Input edge state belongs to simulation so keyboard and touch agree. */
  jumpHeld: boolean;
}
