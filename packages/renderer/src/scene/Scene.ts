import { Transform } from "./Transform";
import { Entity } from "./Entity";

export class Scene {
  name: string;
  root: Transform;
  entities: Entity[] = [];
  private _version: number = 0;

  constructor(name: string = "Scene") {
    this.name = name;
    this.root = new Transform();
  }

  get version(): number {
    return this._version;
  }

  add(entity: Entity): void {
    const wasAlreadyAdded = this.entities.includes(entity);
    if (!wasAlreadyAdded) {
      this.entities.push(entity);
      this._version++;
    }
    if (!entity.transform.parent) {
      this.root.addChild(entity.transform);
    }
  }

  remove(entity: Entity): void {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
      entity.transform.remove();
      this._version++;
    }
  }

  update(deltaTime: number): void {
    for (const entity of this.entities) {
      if (entity.enabled && entity.needsUpdate) {
        entity.update?.(deltaTime);
      }
    }
  }
}
