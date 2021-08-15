import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@material-ui/core";
import { useCallback, useState, useEffect, useRef } from "react";
import { useStoreState } from "react-flow-renderer";
import { ComponentSpec, isGraphImplementation } from "../componentSpec";
import {
  loadComponentAsRefFromText,
  getAllComponentFilesFromList,
  ComponentFileEntry,
  addComponentToListByText,
  componentSpecToYaml,
} from "../componentStore";
import GraphComponentLink from "./GraphComponentLink";
import { augmentComponentSpec } from "./GraphComponentSpecFlow";
import SamplePipelineLibrary from "./SamplePipelineLibrary";
import { preloadComponentReferences } from "./samplePipelines";

const USER_PIPELINES_LIST_NAME = "user_pipelines";

interface PipelineLibraryProps {
  componentSpec?: ComponentSpec;
  setComponentSpec?: (componentSpec: ComponentSpec) => void;
}

const removeSuffixes = (s: string, suffixes: string[]) => {
  for (const suffix of suffixes) {
    if (s.endsWith(suffix)) {
      s = s.substring(0, s.length - suffix.length);
    }
  }
  return s;
};

interface SavePipelineAsDialogProps {
  componentSpec: ComponentSpec;
  isOpen: boolean;
  onPipelineSave: (name: string, componentText: string) => void;
  onCancel: () => void;
}

const SavePipelineAsDialog = ({
  componentSpec,
  isOpen,
  onPipelineSave,
  onCancel,
}: SavePipelineAsDialogProps) => {
  const nodes = useStoreState((store) => store.nodes);

  const handleSave = (name: string) => {
    let componentText = "";
    try {
      const graphComponent = augmentComponentSpec(
        componentSpec,
        nodes,
        false,
        true
      );
      graphComponent.name = name;
      componentText = componentSpecToYaml(graphComponent);
      onPipelineSave(name, componentText);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SaveAsDialog
      isOpen={isOpen}
      onSave={handleSave}
      onCancel={onCancel}
      initialValue={componentSpec.name}
      inputLabel="Pipeline name"
    />
  );
};

interface SaveAsDialogProps {
  isOpen: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
  initialValue: string | undefined;
  inputLabel: string;
}

const SaveAsDialog = ({
  isOpen,
  onSave,
  onCancel,
  initialValue,
  inputLabel = "Pipeline name"
}: SaveAsDialogProps) => {
  const nameInputRef = useRef<HTMLInputElement>();
  return (
    <Dialog open={isOpen} aria-labelledby="alert-dialog-title">
      <DialogTitle id="alert-dialog-title">{"Save pipeline"}</DialogTitle>
      <form
        onSubmit={(e) => {
          if (nameInputRef.current) {
            onSave(nameInputRef.current.value);
          }
          e.preventDefault();
        }}
      >
        <DialogContent>
          <TextField
            id="name"
            type="text"
            defaultValue={initialValue}
            label={inputLabel}
            inputRef={nameInputRef}
            required
            autoFocus
            fullWidth
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button color="primary" type="submit" autoFocus>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

const PipelineLibrary = ({
  componentSpec,
  setComponentSpec,
}: PipelineLibraryProps) => {
  // const [errorMessage, setErrorMessage] = useState("");
  const [componentFiles, setComponentFiles] = useState(
    new Map<string, ComponentFileEntry>()
  );
  const [pipelineFile, setPipelineFile] = useState<ComponentFileEntry>();
  const [saveAsDialogIsOpen, setSaveAsDialogIsOpen] = useState(false);

  const refreshPipelines = useCallback(() => {
    getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME).then(
      setComponentFiles
    );
  }, [setComponentFiles]);

  useEffect(refreshPipelines, [refreshPipelines]);

  const openPipelineFile = useCallback(
    async (fileEntry: ComponentFileEntry) => {
      // Loading all child components
      // TODO: Move this functionality to the setComponentSpec function
      await preloadComponentReferences(fileEntry.componentRef.spec);
      setComponentSpec?.(fileEntry.componentRef.spec);
      setPipelineFile(fileEntry);
    },
    [setComponentSpec, setPipelineFile]
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onabort = () => console.log("file reading was aborted");
      reader.onerror = () => console.log("file reading has failed");
      reader.onload = async () => {
        const binaryStr = reader.result;
        if (binaryStr === null || binaryStr === undefined) {
          console.error(`Dropped file reader result was ${binaryStr}`);
          return;
        }
        const fileName =
          removeSuffixes(file.name, [
            ".pipeline.component.yaml",
            ".component.yaml",
            ".pipeline.yaml",
            ".yaml",
          ]) || "Pipeline";
        try {
          const componentRefPlusData1 = await loadComponentAsRefFromText(binaryStr);
          const componentRef1 = componentRefPlusData1.componentRef;
          if (!isGraphImplementation(componentRef1.spec.implementation)) {
            console.error("Dropped component is not a graph component");
            return;
          }
          // Caching the child components
          await preloadComponentReferences(componentRef1.spec);
          // TODO: Do not load the component twice
          const componentRefPlusData = await addComponentToListByText(
            USER_PIPELINES_LIST_NAME,
            binaryStr,
            fileName
          );
          const componentRef = componentRefPlusData.componentRef;
          console.debug("storeComponentText succeeded", componentRef);
          (window as any).gtag?.("event", "PipelineLibrary_pipeline_import", {
            result: "succeeded",
          });
          // setErrorMessage("");
          refreshPipelines();
        } catch (err) {
          // setErrorMessage(
          //   `Error parsing the dropped file as component: ${err.toString()}.`
          // );
          console.error("Error parsing the dropped file as component", err);
          (window as any).gtag?.("event", "PipelineLibrary_pipeline_import", {
            result: "failed",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, [refreshPipelines]);

  const openSaveAsDialog = useCallback(() => {
    setSaveAsDialogIsOpen(true);
  }, [setSaveAsDialogIsOpen]);

  const closeSaveAsDialog = useCallback(() => {
    setSaveAsDialogIsOpen(false);
  }, [setSaveAsDialogIsOpen]);

  const handlePipelineSave = useCallback(
    async (name: string, componentText: string) => {
      const fileEntry = await addComponentToListByText(
        USER_PIPELINES_LIST_NAME,
        componentText,
        name
      );
      await openPipelineFile(fileEntry);
      closeSaveAsDialog();
      refreshPipelines();
    },
    [openPipelineFile, closeSaveAsDialog, refreshPipelines]
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const componentLink = useRef<HTMLAnchorElement>(null);

  return (
    <div
      style={{
        //border: "1px solid black",
        overflow: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ margin: "5px" }}>
        <button onClick={openSaveAsDialog}>Save as</button>
        {componentSpec && (
          <SavePipelineAsDialog
            isOpen={saveAsDialogIsOpen}
            onCancel={closeSaveAsDialog}
            componentSpec={componentSpec}
            onPipelineSave={handlePipelineSave}
          />
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".yaml"
          onChange={(e) => onDrop(Array.from(e.target.files ?? []))}
          style={{ display: "none" }}
        />
        <button onClick={(e) => fileInput.current?.click()}>
          + Import pipeline
        </button>
        <button
          onClick={(e) => {
            componentLink.current?.click();
          }}
        >
          Export pipeline
        </button>
        {componentSpec && (
          <GraphComponentLink
            linkRef={componentLink}
            componentSpec={componentSpec}
            linkText="🔗"
            downloadFileName={
              (componentSpec.name ? componentSpec.name + "." : "") +
              "pipeline.component.yaml"
            }
            style={{ textDecoration: "none" }}
          />
        )}
      </div>
      <div style={{ overflow: "auto", marginLeft: "10px" }}>
        {Array.from(componentFiles.entries()).map(([fileName, fileEntry]) => (
          <div key={fileName}>
            ⋮ {/* ⋮ ≡ ⋅ */}
            <button
              className="link-button"
              onClick={(e) => openPipelineFile(fileEntry)}
              style={
                fileName === pipelineFile?.name
                  ? { fontWeight: "bold" }
                  : undefined
              }
            >
              {fileName}
            </button>
          </div>
        ))}
      </div>
      <details
        open
        style={{
          border: "1px solid #aaa",
          borderRadius: "4px",
          padding: "4px",
        }}
      >
        <summary>
          <strong>Sample pipelines</strong>
        </summary>
        <SamplePipelineLibrary setComponentSpec={setComponentSpec} />
      </details>
    </div>
  );
};

export default PipelineLibrary;
