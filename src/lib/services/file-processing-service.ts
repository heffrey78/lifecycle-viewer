/**
 * File Processing Service
 *
 * Handles client-side file content reading and validation for chat interface
 */

export interface FileContent {
	filename: string;
	content: string;
	size: number;
	type: string;
	lastModified: Date;
	encoding?: string;
}

export interface FileProcessingResult {
	success: boolean;
	fileContent?: FileContent;
	error?: string;
	warning?: string;
}

export interface FileProcessingOptions {
	maxSizeBytes?: number;
	allowedTypes?: string[];
	encoding?: 'utf-8' | 'base64';
}

export class FileProcessingService {
	private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
	private readonly DEFAULT_ALLOWED_TYPES = [
		'text/plain',
		'text/markdown',
		'application/json',
		'text/csv',
		'application/csv',
		'text/xml',
		'application/xml',
		'text/javascript',
		'application/javascript',
		'text/typescript',
		'text/html',
		'text/css',
		'application/yaml',
		'text/yaml'
	];

	private readonly FILE_EXTENSION_MAPPING: Record<string, string> = {
		'.txt': 'text/plain',
		'.md': 'text/markdown',
		'.markdown': 'text/markdown',
		'.json': 'application/json',
		'.csv': 'text/csv',
		'.xml': 'application/xml',
		'.js': 'text/javascript',
		'.ts': 'text/typescript',
		'.tsx': 'text/typescript',
		'.jsx': 'text/javascript',
		'.html': 'text/html',
		'.htm': 'text/html',
		'.css': 'text/css',
		'.yml': 'application/yaml',
		'.yaml': 'application/yaml',
		'.log': 'text/plain',
		'.cfg': 'text/plain',
		'.conf': 'text/plain',
		'.ini': 'text/plain'
	};

	/**
	 * Process and read file content using FileReader API
	 */
	async processFile(
		file: File,
		options: FileProcessingOptions = {}
	): Promise<FileProcessingResult> {
		const {
			maxSizeBytes = this.DEFAULT_MAX_SIZE,
			allowedTypes = this.DEFAULT_ALLOWED_TYPES,
			encoding = 'utf-8'
		} = options;

		try {
			// Validate file size
			if (file.size > maxSizeBytes) {
				return {
					success: false,
					error: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSizeBytes)})`
				};
			}

			// Validate file type
			const fileType = this.determineFileType(file);
			if (!allowedTypes.includes(fileType)) {
				return {
					success: false,
					error: `File type '${fileType}' is not supported. Allowed types: ${allowedTypes.join(', ')}`
				};
			}

			// Read file content
			const content = await this.readFileAsText(file, encoding);

			// Validate content is readable text
			if (!this.isReadableText(content)) {
				return {
					success: false,
					error: 'File does not contain readable text content'
				};
			}

			const fileContent: FileContent = {
				filename: file.name,
				content: content.trim(),
				size: file.size,
				type: fileType,
				lastModified: new Date(file.lastModified),
				encoding
			};

			// Check for potentially large content
			let warning: string | undefined;
			if (content.length > 50000) {
				// ~50KB of text
				warning = `Large file content (${this.formatFileSize(content.length)} characters). Processing may be slow.`;
			}

			return {
				success: true,
				fileContent,
				warning
			};
		} catch (error) {
			console.error('File processing failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown file processing error'
			};
		}
	}

	/**
	 * Process multiple files in parallel
	 */
	async processFiles(
		files: File[],
		options: FileProcessingOptions = {}
	): Promise<FileProcessingResult[]> {
		if (files.length === 0) {
			return [];
		}

		// Process files in parallel but limit concurrency to avoid overwhelming the browser
		const BATCH_SIZE = 3;
		const results: FileProcessingResult[] = [];

		for (let i = 0; i < files.length; i += BATCH_SIZE) {
			const batch = files.slice(i, i + BATCH_SIZE);
			const batchResults = await Promise.all(batch.map((file) => this.processFile(file, options)));
			results.push(...batchResults);
		}

		return results;
	}

	/**
	 * Read file content as text using FileReader API
	 */
	private readFileAsText(file: File, encoding: string = 'utf-8'): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (event) => {
				const result = event.target?.result;
				if (typeof result === 'string') {
					resolve(result);
				} else {
					reject(new Error('Failed to read file as text'));
				}
			};

			reader.onerror = () => {
				reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
			};

			reader.onabort = () => {
				reject(new Error('File reading was aborted'));
			};

			// Read as text with specified encoding
			reader.readAsText(file, encoding);
		});
	}

	/**
	 * Determine file type from File object and filename extension
	 */
	private determineFileType(file: File): string {
		// First try the file's declared MIME type
		if (file.type && file.type !== '') {
			// Normalize some common variations
			if (file.type === 'text/x-markdown') return 'text/markdown';
			if (file.type === 'application/x-javascript') return 'text/javascript';
			return file.type;
		}

		// Fall back to extension-based detection
		const extension = this.getFileExtension(file.name);
		return this.FILE_EXTENSION_MAPPING[extension] || 'text/plain';
	}

	/**
	 * Get lowercase file extension from filename
	 */
	private getFileExtension(filename: string): string {
		const lastDotIndex = filename.lastIndexOf('.');
		if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
			return '';
		}
		return filename.substring(lastDotIndex).toLowerCase();
	}

	/**
	 * Check if content appears to be readable text
	 */
	private isReadableText(content: string): boolean {
		if (!content || content.length === 0) {
			return false;
		}

		// Check for null bytes (indication of binary content)
		if (content.includes('\0')) {
			return false;
		}

		// Check for reasonable text character ratio
		const totalChars = content.length;
		const printableChars = content.match(/[\x20-\x7E\s]/g)?.length || 0;
		const textRatio = printableChars / totalChars;

		// Content should be at least 80% printable characters
		return textRatio >= 0.8;
	}

	/**
	 * Format file size for human-readable display
	 */
	private formatFileSize(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(1)} ${units[unitIndex]}`;
	}

	/**
	 * Get supported file types for UI display
	 */
	getSupportedFileTypes(): string[] {
		return [...this.DEFAULT_ALLOWED_TYPES];
	}

	/**
	 * Get supported file extensions for UI display
	 */
	getSupportedExtensions(): string[] {
		return Object.keys(this.FILE_EXTENSION_MAPPING);
	}

	/**
	 * Create a file content summary for chat display
	 */
	createContentSummary(fileContent: FileContent): string {
		const lines = fileContent.content.split('\n').length;
		const words = fileContent.content.split(/\s+/).filter((w) => w.length > 0).length;

		return `📄 **${fileContent.filename}** (${this.formatFileSize(fileContent.size)})
- **Type:** ${fileContent.type}
- **Lines:** ${lines.toLocaleString()}
- **Words:** ${words.toLocaleString()}
- **Modified:** ${fileContent.lastModified.toLocaleDateString()}

*File content is available for analysis in this conversation.*`;
	}
}

// Export singleton instance
export const fileProcessingService = new FileProcessingService();
