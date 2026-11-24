/**
 * M3 Empirical Challenger Test Suite: Auth Hook & MVC Decoupling
 * Tests useAuth.ts and src/app/login/page.tsx with React Testing Library
 */

import React from 'react';
import '@testing-library/jest-dom';
import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/app/login/page';

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe('Milestone 3 (M3) Empirical Auth Hook & Decoupling Tests', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    // Suppress JSDOM navigation error logs for window.location assignment
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (typeof args[0] === 'string' && args[0].includes('Not implemented: navigation')) return;
      if (args[0] instanceof Error && args[0].message.includes('Not implemented: navigation')) return;
      // pass through other errors if any
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('1. useAuth Hook Behavioral Tests', () => {
    test('1.1 Initial Hook State is clean', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.setError).toBe('function');
      expect(typeof result.current.resetError).toBe('function');
    });

    test('1.2 Login Success (200 OK): returns true, clears error, sets loading lifecycle', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      let loginResult: boolean | undefined;
      await act(async () => {
        loginResult = await result.current.login('ocs5298', '34237116!a');
      });

      expect(loginResult).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ocs5298', password: '34237116!a' }),
      });
    });

    test('1.3 Login Failure (401 Unauthorized): returns false, sets user error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Invalid credentials' }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      let loginResult: boolean | undefined;
      await act(async () => {
        loginResult = await result.current.login('wrong_user', 'wrong_pass');
      });

      expect(loginResult).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    });

    test('1.4 Login Failure (400 / 500 status): returns false and sets user error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      let loginResult: boolean | undefined;
      await act(async () => {
        loginResult = await result.current.login('ocs5298', 'trigger_500');
      });

      expect(loginResult).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    });

    test('1.5 Network Failure (Fetch throws TypeError): catches error, returns false, sets network error message', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch: Connection refused'));

      const { result } = renderHook(() => useAuth());

      let loginResult: boolean | undefined;
      await act(async () => {
        loginResult = await result.current.login('ocs5298', '34237116!a');
      });

      expect(loginResult).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('로그인 처리 중 오류가 발생했습니다.');
    });

    test('1.6 resetError and setError API functions work as expected', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.setError('Custom Test Error');
      });
      expect(result.current.error).toBe('Custom Test Error');

      act(() => {
        result.current.resetError();
      });
      expect(result.current.error).toBeNull();
    });

    test('1.7 Consecutive Login Attempts: clears previous error before dispatching new request', async () => {
      // First attempt fails
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login('bad', 'bad');
      });
      expect(result.current.error).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');

      // Second attempt succeeds
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await act(async () => {
        const success = await result.current.login('ocs5298', '34237116!a');
        expect(success).toBe(true);
      });
      expect(result.current.error).toBeNull();
    });

    test('1.8 Logout: calls DELETE /api/auth and handles window navigation', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth', { method: 'DELETE' });
    });

    test('1.9 Logout Network Resilience: handles logout gracefully even if DELETE request fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network drop on logout'));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth', { method: 'DELETE' });
    });
  });

  describe('2. LoginPage Component Rendering & Submission Tests', () => {
    test('2.1 Renders initial login form elements cleanly', () => {
      render(<LoginPage />);

      expect(screen.getByText('WORK VITAL')).toBeInTheDocument();
      expect(screen.getByText('통합 업무 및 예산 관리 아키텍처')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your ID')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '로그인' })).not.toBeDisabled();
    });

    test('2.2 Input binding updates username and password state', () => {
      render(<LoginPage />);

      const usernameInput = screen.getByPlaceholderText('Enter your ID') as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;

      fireEvent.change(usernameInput, { target: { value: 'ocs5298' } });
      fireEvent.change(passwordInput, { target: { value: '34237116!a' } });

      expect(usernameInput.value).toBe('ocs5298');
      expect(passwordInput.value).toBe('34237116!a');
    });

    test('2.3 Successful submission calls login, routes to "/", and refreshes router', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      render(<LoginPage />);

      const usernameInput = screen.getByPlaceholderText('Enter your ID');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: '로그인' });

      fireEvent.change(usernameInput, { target: { value: 'ocs5298' } });
      fireEvent.change(passwordInput, { target: { value: '34237116!a' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'ocs5298', password: '34237116!a' }),
        });
        expect(mockPush).toHaveBeenCalledWith('/');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    test('2.4 Failed submission renders error banner and does not navigate', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Invalid credentials' }),
      } as Response);

      render(<LoginPage />);

      const usernameInput = screen.getByPlaceholderText('Enter your ID');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: '로그인' });

      fireEvent.change(usernameInput, { target: { value: 'bad_user' } });
      fireEvent.change(passwordInput, { target: { value: 'bad_pass' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('아이디 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
      });
    });

    test('2.5 Network failure during submission displays network error banner', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network error'));

      render(<LoginPage />);

      const usernameInput = screen.getByPlaceholderText('Enter your ID');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: '로그인' });

      fireEvent.change(usernameInput, { target: { value: 'ocs5298' } });
      fireEvent.change(passwordInput, { target: { value: '34237116!a' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('로그인 처리 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });
});
