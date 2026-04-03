import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, Square, X, StopCircle, Mic, Globe, BrainCog, FolderCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1a1a1f] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#333333] bg-[#131318] p-0 shadow-xl rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#2E3033]/80 p-2 hover:bg-[#2E3033] transition-all">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-gray-100", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const v = { default: "bg-white hover:bg-white/80 text-black", outline: "border border-[#444] bg-transparent hover:bg-[#3A3A40]", ghost: "bg-transparent hover:bg-[#3A3A40]" };
    const s = { default: "h-10 px-4 py-2", sm: "h-8 px-3 text-sm", lg: "h-12 px-6", icon: "h-8 w-8 rounded-full aspect-[1/1]" };
    return <button className={cn("inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50", v[variant], s[size], className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

// VoiceRecorder Component
interface VoiceRecorderProps { isRecording: boolean; onStartRecording: () => void; onStopRecording: (duration: number) => void; visualizerBars?: number; }
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ isRecording, onStartRecording, onStopRecording, visualizerBars = 32 }) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  React.useEffect(() => {
    if (isRecording) {
      onStartRecording();
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      onStopRecording(time);
      setTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  return (
    <div className={cn("flex flex-col items-center justify-center w-full transition-all duration-300 py-3", isRecording ? "opacity-100" : "opacity-0 h-0")}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-sm text-white/80">{fmt(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div key={i} className="w-0.5 rounded-full bg-white/50 animate-pulse"
            style={{ height: `${Math.max(15, Math.random() * 100)}%`, animationDelay: `${i * 0.05}s`, animationDuration: `${0.5 + Math.random() * 0.5}s` }} />
        ))}
      </div>
    </div>
  );
};

// ImageViewDialog
const ImageViewDialog: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
          className="relative bg-[#131318] rounded-2xl overflow-hidden shadow-2xl">
          <img src={imageUrl} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-2xl" />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context
interface PromptInputContextType { isLoading: boolean; value: string; setValue: (v: string) => void; maxHeight: number | string; onSubmit?: () => void; disabled?: boolean; }
const PromptInputContext = React.createContext<PromptInputContextType>({ isLoading: false, value: "", setValue: () => {}, maxHeight: 240, onSubmit: undefined, disabled: false });
function usePromptInput() { return React.useContext(PromptInputContext); }

interface PromptInputProps {
  isLoading?: boolean; value?: string; onValueChange?: (v: string) => void; maxHeight?: number | string;
  onSubmit?: () => void; children: React.ReactNode; className?: string; disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void; onDragLeave?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  ({ className, isLoading = false, maxHeight = 240, value, onValueChange, onSubmit, children, disabled = false, onDragOver, onDragLeave, onDrop }, ref) => {
    const [iv, setIv] = React.useState(value || "");
    const change = (v: string) => { setIv(v); onValueChange?.(v); };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider value={{ isLoading, value: value ?? iv, setValue: onValueChange ?? change, maxHeight, onSubmit, disabled }}>
          <div ref={ref} className={cn("rounded-3xl border border-[rgba(255,255,255,0.09)] bg-[rgba(19,19,24,0.92)] backdrop-blur-[20px] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300", isLoading && "border-[#FF8A4C]/50", className)}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>{children}</div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

const PromptInputTextarea: React.FC<{ disableAutosize?: boolean; placeholder?: string } & React.ComponentProps<typeof Textarea>> = ({ className, onKeyDown, disableAutosize = false, placeholder, ...props }) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (disableAutosize || !ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = typeof maxHeight === "number" ? `${Math.min(ref.current.scrollHeight, maxHeight)}px` : `min(${ref.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);
  return <Textarea ref={ref} value={value} onChange={e => setValue(e.target.value)}
    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit?.(); } onKeyDown?.(e); }}
    className={cn("text-base", className)} disabled={disabled} placeholder={placeholder} {...props} />;
};

const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>{children}</div>
);

const PromptInputAction: React.FC<{ tooltip: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right"; className?: string }> = ({ tooltip, children, className, side = "top" }) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip>
      <TooltipTrigger asChild disabled={disabled}>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

// Custom Divider
const CustomDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1">
    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#FF8A4C]/50 to-transparent rounded-full"
      style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)" }} />
  </div>
);

// Main PromptInputBox Component
interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const { onSend = () => {}, isLoading = false, placeholder = "Ask about your workforce...", className } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showThink, setShowThink] = React.useState(false);
  const [showCanvas, setShowCanvas] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);

  const handleToggle = (v: string) => {
    if (v === "search") { setShowSearch(p => !p); setShowThink(false); }
    else if (v === "think") { setShowThink(p => !p); setShowSearch(false); }
  };

  const isImage = (f: File) => f.type.startsWith("image/");
  const processFile = (file: File) => {
    if (!isImage(file) || file.size > 10 * 1024 * 1024) return;
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = e => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleDragOver = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragLeave = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const imgs = Array.from(e.dataTransfer.files).filter(f => isImage(f));
    if (imgs.length > 0) processFile(imgs[0]);
  }, []);

  const handleRemoveFile = (i: number) => {
    const f = files[i];
    if (f && filePreviews[f.name]) setFilePreviews({});
    setFiles([]);
  };

  React.useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) { e.preventDefault(); processFile(file); break; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  const handleSubmit = () => {
    if (input.trim() || files.length > 0) {
      let prefix = showSearch ? "[Search: " : showThink ? "[Think: " : showCanvas ? "[Canvas: " : "";
      onSend(prefix ? `${prefix}${input}]` : input, files);
      setInput(""); setFiles([]); setFilePreviews({});
    }
  };

  const hasContent = input.trim() !== "" || files.length > 0;

  return (
    <>
      <PromptInput value={input} onValueChange={setInput} isLoading={isLoading} onSubmit={handleSubmit}
        className={cn("w-full transition-all duration-300 ease-in-out", isRecording && "border-red-500/70", className)}
        disabled={isLoading || isRecording} ref={ref || promptBoxRef}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {/* File previews */}
        {files.length > 0 && !isRecording && (
          <div className="flex flex-wrap gap-2 p-0 pb-1">
            {files.map((file, i) => (
              <div key={i} className="relative group">
                {file.type.startsWith("image/") && filePreviews[file.name] && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer" onClick={() => setSelectedImage(filePreviews[file.name])}>
                    <img src={filePreviews[file.name]} alt={file.name} className="h-full w-full object-cover" />
                    <button onClick={e => { e.stopPropagation(); handleRemoveFile(i); }}
                      className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5"><X className="h-3 w-3 text-white" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className={cn("transition-all duration-300", isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100")}>
          <PromptInputTextarea placeholder={showSearch ? "Search recognition data..." : showThink ? "Deep analysis mode..." : showCanvas ? "Generate report..." : placeholder} className="text-base" />
        </div>

        {/* Voice recorder */}
        {isRecording && <VoiceRecorder isRecording={isRecording} onStartRecording={() => {}} onStopRecording={d => { setIsRecording(false); onSend(`[Voice message - ${d}s]`, []); }} />}

        {/* Actions bar */}
        <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
          <div className={cn("flex items-center gap-1 transition-opacity duration-300", isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible")}>
            {/* Upload */}
            <PromptInputAction tooltip="Upload image">
              <button onClick={() => uploadInputRef.current?.click()} disabled={isRecording}
                className="flex h-8 w-8 text-[#71717a] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/5 hover:text-[#a1a1aa]">
                <Paperclip className="h-5 w-5" />
                <input ref={uploadInputRef} type="file" className="hidden" accept="image/*"
                  onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]); if (e.target) e.target.value = ""; }} />
              </button>
            </PromptInputAction>

            {/* Mode toggles */}
            <div className="flex items-center">
              <button type="button" onClick={() => handleToggle("search")}
                className={cn("rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                  showSearch ? "bg-[#60a5fa]/15 border-[#60a5fa] text-[#60a5fa]" : "bg-transparent border-transparent text-[#71717a] hover:text-[#a1a1aa]")}>
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <motion.div animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                    whileHover={{ rotate: showSearch ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}>
                    <Globe className="w-4 h-4" />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showSearch && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }} className="text-xs overflow-hidden whitespace-nowrap flex-shrink-0">Search</motion.span>}
                </AnimatePresence>
              </button>

              <CustomDivider />

              <button type="button" onClick={() => handleToggle("think")}
                className={cn("rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                  showThink ? "bg-[#a78bfa]/15 border-[#a78bfa] text-[#a78bfa]" : "bg-transparent border-transparent text-[#71717a] hover:text-[#a1a1aa]")}>
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <motion.div animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                    whileHover={{ rotate: showThink ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}>
                    <BrainCog className="w-4 h-4" />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showThink && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }} className="text-xs overflow-hidden whitespace-nowrap flex-shrink-0">Think</motion.span>}
                </AnimatePresence>
              </button>

              <CustomDivider />

              <button type="button" onClick={() => setShowCanvas(p => !p)}
                className={cn("rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                  showCanvas ? "bg-[#FF8A4C]/15 border-[#FF8A4C] text-[#FF8A4C]" : "bg-transparent border-transparent text-[#71717a] hover:text-[#a1a1aa]")}>
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <motion.div animate={{ rotate: showCanvas ? 360 : 0, scale: showCanvas ? 1.1 : 1 }}
                    whileHover={{ rotate: showCanvas ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}>
                    <FolderCode className="w-4 h-4" />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showCanvas && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }} className="text-xs overflow-hidden whitespace-nowrap flex-shrink-0">Report</motion.span>}
                </AnimatePresence>
              </button>
            </div>
          </div>

          {/* Send / Voice / Stop button */}
          <PromptInputAction tooltip={isLoading ? "Stop" : isRecording ? "Stop recording" : hasContent ? "Send" : "Voice"}>
            <Button variant="default" size="icon"
              className={cn("h-8 w-8 rounded-full transition-all duration-200",
                isRecording ? "bg-transparent hover:bg-white/5 text-red-500" :
                hasContent ? "bg-[#FF8A4C] hover:bg-[#FF8A4C]/80 text-[#09090b]" :
                "bg-transparent hover:bg-white/5 text-[#71717a] hover:text-[#a1a1aa]")}
              onClick={() => { if (isRecording) setIsRecording(false); else if (hasContent) handleSubmit(); else setIsRecording(true); }}
              disabled={isLoading && !hasContent}>
              {isLoading ? <Square className="h-4 w-4 fill-current animate-pulse" /> :
               isRecording ? <StopCircle className="h-5 w-5 text-red-500" /> :
               hasContent ? <ArrowUp className="h-4 w-4" /> :
               <Mic className="h-5 w-5" />}
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";
