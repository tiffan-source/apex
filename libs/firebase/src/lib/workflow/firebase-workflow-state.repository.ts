import type { IWorkflowStateRepository, WorkflowState } from "@org/ai-assistant";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FirebaseClientDataAccess } from "../firebase-client";

const COLLECTION = "workflow-states";

export class FirebaseWorkflowStateRepository implements IWorkflowStateRepository {
  constructor(private readonly firebase: FirebaseClientDataAccess) {}

  async save(state: WorkflowState): Promise<void> {
    await setDoc(doc(this.firebase.db, COLLECTION, state.id), toPlain(state), { merge: true });
  }

  async findById(id: string): Promise<WorkflowState | null> {
    const snapshot = await getDoc(doc(this.firebase.db, COLLECTION, id));
    return snapshot.exists() ? (snapshot.data() as WorkflowState) : null;
  }
}

/**
 * Flatten the state into a Firestore-safe document. The deep clone strips class
 * prototypes (the context holds `AIResponse` instances) so Firestore stores plain
 * data rather than rejecting the write.
 */
function toPlain(state: WorkflowState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state));
}
