import { App, Modal, Notice, Setting, TFile } from "obsidian";

export class ConflictResolutionModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "Sync Conflicts / 同步冲突管理" });
    
    const allFiles = this.app.vault.getFiles();
    const conflictFiles = allFiles.filter(file => file.name.includes(".sync-conflict-"));
    
    if (conflictFiles.length === 0) {
      const msg = contentEl.createEl("div", { text: "No conflict files found in the vault! / 仓库中未发现冲突文件。" });
      msg.style.color = "var(--text-success)";
      msg.style.padding = "20px";
      msg.style.textAlign = "center";
      msg.style.fontWeight = "bold";
      return;
    }
    
    if (conflictFiles.length > 1) {
      new Setting(contentEl)
        .setName(`Found ${conflictFiles.length} conflict files / 发现 ${conflictFiles.length} 个冲突文件`)
        .addButton(btn => btn
          .setButtonText("全部保留当前版本 (Keep All Current)")
          .setWarning()
          .onClick(async () => {
            for (const file of conflictFiles) {
              await this.app.vault.trash(file, true); // Send to trash or delete
            }
            new Notice(`Deleted ${conflictFiles.length} conflict files.`);
            this.onOpen();
          })
        );
      contentEl.createEl("hr");
    }
    
    const listEl = contentEl.createEl("div", { cls: "conflict-list" });
    
    for (const conflictFile of conflictFiles) {
      // Basic regex to extract base file name
      // Expected: filename.sync-conflict-YYYYMMDD-HHmmss-xxx.ext or similar
      let baseFileName = "";
      const match = conflictFile.name.match(/^(.*)\.sync-conflict-[^.]+(\.[^.]+)?$/);
      if (match) {
        baseFileName = match[1] + (match[2] || "");
      } else {
        baseFileName = conflictFile.name.replace(/\.sync-conflict-[a-zA-Z0-9-]+/, "");
      }
      
      const basePath = (conflictFile.parent && conflictFile.parent.path !== "/") 
        ? `${conflictFile.parent.path}/${baseFileName}`
        : baseFileName;
        
      const baseFile = this.app.vault.getAbstractFileByPath(basePath);
      
      const cardEl = listEl.createEl("div", { cls: "conflict-card" });
      cardEl.style.border = "1px solid var(--background-modifier-border)";
      cardEl.style.borderRadius = "8px";
      cardEl.style.padding = "15px";
      cardEl.style.marginBottom = "15px";
      
      cardEl.createEl("h4", { text: conflictFile.name, cls: "conflict-file-name" });
      cardEl.createEl("div", { text: `Path: ${conflictFile.path}`, cls: "conflict-file-path" });
      cardEl.createEl("div", { 
        text: baseFile ? `Base file exists: ${baseFile.path}` : `Base file not found (will be created if adopted)`,
        cls: "conflict-base-status"
      });
      
      const btnContainer = cardEl.createEl("div", { cls: "conflict-actions" });
      btnContainer.style.display = "flex";
      btnContainer.style.gap = "10px";
      btnContainer.style.marginTop = "10px";
      btnContainer.style.flexWrap = "wrap";
      
      const keepBtn = btnContainer.createEl("button", { text: "✓ 保留当前版本 (Keep Current)" });
      keepBtn.onclick = async () => {
        await this.app.vault.trash(conflictFile, true);
        new Notice(`Deleted ${conflictFile.name}`);
        this.onOpen(); // Refresh
      };
      
      const useConflictBtn = btnContainer.createEl("button", { text: "↺ 采纳冲突副本 (Use Conflict Copy)" });
      useConflictBtn.onclick = async () => {
        const conflictContent = await this.app.vault.read(conflictFile);
        if (baseFile instanceof TFile) {
          await this.app.vault.modify(baseFile, conflictContent);
        } else {
          await this.app.vault.create(basePath, conflictContent);
        }
        await this.app.vault.trash(conflictFile, true);
        new Notice(`Adopted conflict copy for ${baseFileName}`);
        this.onOpen(); // Refresh
      };
      
      const sideBySideBtn = btnContainer.createEl("button", { text: "📖 并排对比 (Side by Side)" });
      sideBySideBtn.onclick = async () => {
        if (baseFile instanceof TFile) {
          const leaf1 = this.app.workspace.getLeaf(false);
          await leaf1.openFile(baseFile);
          
          const leaf2 = this.app.workspace.getLeaf('split');
          await leaf2.openFile(conflictFile);
        } else {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(conflictFile);
          new Notice("Base file does not exist, opened conflict file only.");
        }
        this.close();
      };
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
