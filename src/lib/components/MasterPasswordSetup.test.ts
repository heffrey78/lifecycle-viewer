import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import MasterPasswordSetup from './MasterPasswordSetup.svelte';

// Mock the master password service
vi.mock('$lib/services/master-password-service', () => ({
	masterPasswordService: {
		setupMasterPassword: vi.fn(),
		unlock: vi.fn(),
		unlockWithBackupCode: vi.fn()
	}
}));

describe('MasterPasswordSetup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('First-time setup flow', () => {
		it('should show setup form when isFirstTime=true', () => {
			const { getByText, getByLabelText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: true }
			});

			expect(getByText('🔐 Set Up Master Password')).toBeInTheDocument();
			expect(getByLabelText('Master Password')).toBeInTheDocument();
			expect(getByLabelText('Confirm Password')).toBeInTheDocument();
			expect(getByText('Set Up')).toBeInTheDocument();
		});

		it('should reactively update to setup mode when isFirstTime changes to true', async () => {
			const { component, getByText, queryByText, rerender } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			// Initially should show unlock form
			expect(getByText('🔓 Unlock Secure Storage')).toBeInTheDocument();
			expect(queryByText('🔐 Set Up Master Password')).not.toBeInTheDocument();

			// Update prop to first time
			await rerender({ isOpen: true, isFirstTime: true });

			// Should now show setup form
			await waitFor(() => {
				expect(getByText('🔐 Set Up Master Password')).toBeInTheDocument();
			});
			expect(queryByText('🔓 Unlock Secure Storage')).not.toBeInTheDocument();
		});

		it('should validate password requirements in setup mode', async () => {
			const { getByLabelText, getByText, queryByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: true }
			});

			const passwordInput = getByLabelText('Master Password');
			const confirmInput = getByLabelText('Confirm Password');
			const setupButton = getByText('Set Up');

			// Test empty password
			await fireEvent.click(setupButton);
			await waitFor(() => {
				expect(queryByText('Please enter a master password')).toBeInTheDocument();
			});

			// Test short password
			await fireEvent.input(passwordInput, { target: { value: 'short' } });
			await fireEvent.click(setupButton);
			await waitFor(() => {
				expect(queryByText('Master password must be at least 8 characters')).toBeInTheDocument();
			});

			// Test mismatched passwords
			await fireEvent.input(passwordInput, { target: { value: 'validpassword123' } });
			await fireEvent.input(confirmInput, { target: { value: 'different123' } });
			await fireEvent.click(setupButton);
			await waitFor(() => {
				expect(queryByText('Passwords do not match')).toBeInTheDocument();
			});
		});

		it('should call setupMasterPassword with correct parameters', async () => {
			const { masterPasswordService } = await import('$lib/services/master-password-service');
			vi.mocked(masterPasswordService.setupMasterPassword).mockResolvedValue({
				backupCodes: ['AA-BB-CC-DD', 'EE-FF-GG-HH']
			});

			const { getByLabelText, getByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: true }
			});

			const passwordInput = getByLabelText('Master Password');
			const confirmInput = getByLabelText('Confirm Password');
			const rememberCheckbox = getByLabelText('Remember me for 7 days');
			const setupButton = getByText('Set Up');

			await fireEvent.input(passwordInput, { target: { value: 'validpassword123' } });
			await fireEvent.input(confirmInput, { target: { value: 'validpassword123' } });
			await fireEvent.click(rememberCheckbox);
			await fireEvent.click(setupButton);

			await waitFor(() => {
				expect(mockMasterPasswordService.setupMasterPassword).toHaveBeenCalledWith(
					'validpassword123',
					true
				);
			});
		});

		it('should show backup codes after successful setup', async () => {
			const backupCodes = ['AA-BB-CC-DD', 'EE-FF-GG-HH', 'II-JJ-KK-LL'];
			mockMasterPasswordService.setupMasterPassword.mockResolvedValue({ backupCodes });

			const { getByLabelText, getByText, queryByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: true }
			});

			const passwordInput = getByLabelText('Master Password');
			const confirmInput = getByLabelText('Confirm Password');
			const setupButton = getByText('Set Up');

			await fireEvent.input(passwordInput, { target: { value: 'validpassword123' } });
			await fireEvent.input(confirmInput, { target: { value: 'validpassword123' } });
			await fireEvent.click(setupButton);

			await waitFor(() => {
				expect(getByText('🔐 Save Your Backup Codes')).toBeInTheDocument();
			});

			// Check all backup codes are displayed
			backupCodes.forEach((code) => {
				expect(getByText(code)).toBeInTheDocument();
			});

			expect(getByText('📋 Copy Codes')).toBeInTheDocument();
			expect(getByText("I've Saved These")).toBeInTheDocument();
		});
	});

	describe('Unlock flow', () => {
		it('should show unlock form when isFirstTime=false', () => {
			const { getByText, getByLabelText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			expect(getByText('🔓 Unlock Secure Storage')).toBeInTheDocument();
			expect(getByLabelText('Master Password')).toBeInTheDocument();
			expect(getByText('Unlock')).toBeInTheDocument();
			expect(getByText('Use backup code')).toBeInTheDocument();
		});

		it('should call unlock with correct parameters', async () => {
			mockMasterPasswordService.unlock.mockResolvedValue(true);

			const { getByLabelText, getByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			const passwordInput = getByLabelText('Master Password');
			const rememberCheckbox = getByLabelText('Remember me for 7 days');
			const unlockButton = getByText('Unlock');

			await fireEvent.input(passwordInput, { target: { value: 'mypassword123' } });
			await fireEvent.click(rememberCheckbox);
			await fireEvent.click(unlockButton);

			await waitFor(() => {
				expect(mockMasterPasswordService.unlock).toHaveBeenCalledWith('mypassword123', true);
			});
		});

		it('should show error for incorrect password', async () => {
			mockMasterPasswordService.unlock.mockResolvedValue(false);

			const { getByLabelText, getByText, queryByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			const passwordInput = getByLabelText('Master Password');
			const unlockButton = getByText('Unlock');

			await fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
			await fireEvent.click(unlockButton);

			await waitFor(() => {
				expect(queryByText('Incorrect master password')).toBeInTheDocument();
			});
		});

		it('should switch to backup code mode', async () => {
			const { getByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			const backupLink = getByText('Use backup code');
			await fireEvent.click(backupLink);

			await waitFor(() => {
				expect(getByText('🆘 Use Backup Code')).toBeInTheDocument();
				expect(getByText('Backup Code')).toBeInTheDocument();
				expect(getByText('Use Code')).toBeInTheDocument();
			});
		});
	});

	describe('Backup code flow', () => {
		it('should handle backup code unlock', async () => {
			mockMasterPasswordService.unlockWithBackupCode.mockResolvedValue(true);

			const { getByText, getByLabelText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			// Switch to backup mode
			await fireEvent.click(getByText('Use backup code'));

			const backupInput = getByLabelText('Backup Code');
			const useCodeButton = getByText('Use Code');

			await fireEvent.input(backupInput, { target: { value: 'AA-BB-CC-DD' } });
			await fireEvent.click(useCodeButton);

			await waitFor(() => {
				expect(mockMasterPasswordService.unlockWithBackupCode).toHaveBeenCalledWith('AA-BB-CC-DD');
			});
		});

		it('should show error for invalid backup code', async () => {
			mockMasterPasswordService.unlockWithBackupCode.mockResolvedValue(false);

			const { getByText, getByLabelText, queryByText } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			// Switch to backup mode
			await fireEvent.click(getByText('Use backup code'));

			const backupInput = getByLabelText('Backup Code');
			const useCodeButton = getByText('Use Code');

			await fireEvent.input(backupInput, { target: { value: 'INVALID-CODE' } });
			await fireEvent.click(useCodeButton);

			await waitFor(() => {
				expect(queryByText('Invalid or used backup code')).toBeInTheDocument();
			});
		});
	});

	describe('Event dispatching', () => {
		it('should dispatch success event after setup', async () => {
			const backupCodes = ['AA-BB-CC-DD'];
			mockMasterPasswordService.setupMasterPassword.mockResolvedValue({ backupCodes });

			const { getByLabelText, getByText, component } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: true }
			});

			const successHandler = vi.fn();
			component.$on('success', successHandler);

			// Complete setup flow
			await fireEvent.input(getByLabelText('Master Password'), {
				target: { value: 'validpassword123' }
			});
			await fireEvent.input(getByLabelText('Confirm Password'), {
				target: { value: 'validpassword123' }
			});
			await fireEvent.click(getByText('Set Up'));

			// Acknowledge backup codes
			await waitFor(() => getByText("I've Saved These"));
			await fireEvent.click(getByText("I've Saved These"));

			expect(successHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					detail: { backupCodes }
				})
			);
		});

		it('should dispatch unlock event after successful unlock', async () => {
			mockMasterPasswordService.unlock.mockResolvedValue(true);

			const { getByLabelText, getByText, component } = render(MasterPasswordSetup, {
				props: { isOpen: true, isFirstTime: false }
			});

			const unlockHandler = vi.fn();
			component.$on('unlock', unlockHandler);

			await fireEvent.input(getByLabelText('Master Password'), {
				target: { value: 'mypassword123' }
			});
			await fireEvent.click(getByText('Unlock'));

			await waitFor(() => {
				expect(unlockHandler).toHaveBeenCalled();
			});
		});
	});
});
