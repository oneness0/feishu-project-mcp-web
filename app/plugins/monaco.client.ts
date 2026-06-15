import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JSONWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    (self as any).MonacoEnvironment = {
      getWorker(_moduleId: any, label: string) {
        if (label === 'json') {
          return new JSONWorker();
        }
        return new EditorWorker();
      }
    };
  }
});
