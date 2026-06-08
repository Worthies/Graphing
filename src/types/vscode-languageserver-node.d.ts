// Minimal type declarations for vscode-languageserver/node
// The actual library uses "exports" maps that TS 3.9 can't resolve.
// This file provides just the types we need.

declare module "vscode-languageserver/node" {
    import {
        ProposedFeatures, TextDocuments, InitializeParams, InitializeResult,
        TextDocumentSyncKind, Diagnostic, DiagnosticSeverity, Range,
        CompletionItem, CompletionItemKind, InsertTextFormat,
        TextDocumentPositionParams, Hover, MarkupContent, MarkupKind,
        DocumentSymbol, SymbolKind, DocumentSymbolParams,
        DocumentFormattingParams, TextEdit, FormattingOptions,
        InitializeOptions, DocumentColorParams, ColorInformation,
        ColorPresentationParams, ColorPresentation,
        SemanticTokensParams, SemanticTokens
    } from "vscode-languageserver";
    import { TextDocument } from "vscode-languageserver-textdocument";

    interface Disposable { dispose(): void; }

    interface TextDocumentConnection {
        onDidOpenTextDocument(handler: any): Disposable;
        onDidChangeTextDocument(handler: any): Disposable;
        onDidCloseTextDocument(handler: any): Disposable;
        onWillSaveTextDocument(handler: any): Disposable;
        onWillSaveTextDocumentWaitUntil(handler: any): Disposable;
        onDidSaveTextDocument(handler: any): Disposable;
        onNotification(handler: any): Disposable;
        [key: string]: any;
    }

    interface SemanticTokensRangeParams {
        textDocument: { uri: string };
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
    }

    interface Languages {
        semanticTokens: {
            refresh(): void;
            on(handler: (params: SemanticTokensParams) => SemanticTokens): Disposable;
            onRange(handler: (params: SemanticTokensRangeParams) => SemanticTokens): Disposable;
        };
    }

    interface Connection extends TextDocumentConnection {
        console: { log(msg: string): void; info(msg: string): void; warn(msg: string): void; error(msg: string): void };
        languages: Languages;
        onInitialize(handler: (params: InitializeParams) => InitializeResult): void;
        sendDiagnostics(params: { uri: string; diagnostics: Diagnostic[] }): void;
        onCompletion(handler: (params: TextDocumentPositionParams) => CompletionItem[]): void;
        onHover(handler: (params: TextDocumentPositionParams) => Hover | null): void;
        onDocumentSymbol(handler: (params: DocumentSymbolParams) => DocumentSymbol[]): void;
        onDocumentFormatting(handler: (params: DocumentFormattingParams) => TextEdit[]): void;
        onDocumentColor(handler: (params: DocumentColorParams) => ColorInformation[]): void;
        onColorPresentation(handler: (params: ColorPresentationParams) => ColorPresentation[]): void;
        listen(): void;
    }

    function createConnection(features?: any): Connection;

    export {
        createConnection,
        TextDocuments,
        ProposedFeatures,
        InitializeParams,
        InitializeResult,
        TextDocumentSyncKind,
        Diagnostic,
        DiagnosticSeverity,
        Range,
        CompletionItem,
        CompletionItemKind,
        InsertTextFormat,
        TextDocumentPositionParams,
        Hover,
        MarkupContent,
        MarkupKind,
        DocumentSymbol,
        SymbolKind,
        DocumentSymbolParams,
        DocumentFormattingParams,
        TextEdit,
        FormattingOptions,
        InitializeOptions,
        DocumentColorParams,
        ColorInformation,
        ColorPresentationParams,
        ColorPresentation,
        SemanticTokensParams,
        SemanticTokens
    };
}

declare module "vscode-languageclient/node" {
    import { TextDocument } from "vscode-languageserver-textdocument";

    enum TransportKind { ipc = 0 }

    interface ServerOptions {
        run: { module: string; transport: number };
        debug: { module: string; transport: number };
    }

    interface LanguageClientOptions {
        documentSelector: Array<{ scheme: string; language: string }>;
        outputChannel?: any;
        initializationOptions?: any;
    }

    class LanguageClient {
        constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
        start(): { dispose(): void };
        stop(): void;
    }

    export { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind };
}
