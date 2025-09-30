import { describe, it, expect } from 'vitest';
import { FileProcessingService } from './file-processing-service';

describe('FileProcessingService', () => {
	const service = new FileProcessingService();

	describe('processFile', () => {
		it('should successfully process a text file', async () => {
			// Create a mock text file
			const textContent = 'This is a test file\nwith multiple lines\nand some content.';
			const mockFile = new File([textContent], 'test.txt', { type: 'text/plain' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(true);
			expect(result.fileContent).toBeDefined();
			expect(result.fileContent?.filename).toBe('test.txt');
			expect(result.fileContent?.content).toBe(textContent);
			expect(result.fileContent?.type).toBe('text/plain');
			expect(result.fileContent?.size).toBe(textContent.length);
		});

		it('should successfully process a markdown file', async () => {
			const markdownContent = '# Test Document\n\nThis is a **markdown** file with *emphasis*.';
			const mockFile = new File([markdownContent], 'test.md', { type: 'text/markdown' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(true);
			expect(result.fileContent?.type).toBe('text/markdown');
			expect(result.fileContent?.content).toBe(markdownContent);
		});

		it('should reject files that are too large', async () => {
			const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
			const mockFile = new File([largeContent], 'large.txt', { type: 'text/plain' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(false);
			expect(result.error).toContain('exceeds maximum allowed size');
		});

		it('should reject unsupported file types', async () => {
			const content = 'test content';
			const mockFile = new File([content], 'test.exe', { type: 'application/x-executable' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not supported');
		});

		it('should determine file type from extension when MIME type is missing', async () => {
			const jsonContent = '{"test": "data"}';
			const mockFile = new File([jsonContent], 'data.json', { type: '' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(true);
			expect(result.fileContent?.type).toBe('application/json');
		});

		it('should handle empty files gracefully', async () => {
			const mockFile = new File([''], 'empty.txt', { type: 'text/plain' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not contain readable text');
		});

		it('should provide warning for large content', async () => {
			const largeTextContent = 'This is a line of text.\n'.repeat(3000); // ~72KB
			const mockFile = new File([largeTextContent], 'large.txt', { type: 'text/plain' });

			const result = await service.processFile(mockFile);

			expect(result.success).toBe(true);
			expect(result.warning).toContain('Large file content');
		});
	});

	describe('processFiles', () => {
		it('should process multiple files concurrently', async () => {
			const file1 = new File(['File 1 content'], 'file1.txt', { type: 'text/plain' });
			const file2 = new File(['File 2 content'], 'file2.md', { type: 'text/markdown' });

			const results = await service.processFiles([file1, file2]);

			expect(results).toHaveLength(2);
			expect(results[0].success).toBe(true);
			expect(results[1].success).toBe(true);
			expect(results[0].fileContent?.filename).toBe('file1.txt');
			expect(results[1].fileContent?.filename).toBe('file2.md');
		});

		it('should handle empty file array', async () => {
			const results = await service.processFiles([]);
			expect(results).toHaveLength(0);
		});
	});

	describe('createContentSummary', () => {
		it('should create a proper content summary', async () => {
			const content = 'Line 1\nLine 2\nLine 3\nHello world test';
			const fileContent = {
				filename: 'test.txt',
				content,
				size: content.length,
				type: 'text/plain',
				lastModified: new Date('2024-01-01'),
				encoding: 'utf-8'
			};

			const summary = service.createContentSummary(fileContent);

			expect(summary).toContain('**test.txt**');
			expect(summary).toContain('text/plain');
			expect(summary).toContain('4'); // lines
			expect(summary).toContain('9'); // words (corrected count)
			expect(summary).toContain('12/31/2023'); // date (corrected format)
		});
	});

	describe('getSupportedFileTypes', () => {
		it('should return array of supported MIME types', () => {
			const types = service.getSupportedFileTypes();
			expect(Array.isArray(types)).toBe(true);
			expect(types).toContain('text/plain');
			expect(types).toContain('text/markdown');
			expect(types).toContain('application/json');
		});
	});

	describe('getSupportedExtensions', () => {
		it('should return array of supported file extensions', () => {
			const extensions = service.getSupportedExtensions();
			expect(Array.isArray(extensions)).toBe(true);
			expect(extensions).toContain('.txt');
			expect(extensions).toContain('.md');
			expect(extensions).toContain('.json');
		});
	});
});
