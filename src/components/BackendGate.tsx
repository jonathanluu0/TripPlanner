import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Card, Center, Code, Loader, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { backendKind } from '../backend';
import { initBackend } from '../backend/bootstrap';

/**
 * Holds the app back until the backend is ready: in Supabase mode that means
 * signing in as a guest and loading this guest's trips. If setup is wrong
 * (missing keys, anonymous sign-ins disabled), we say so instead of failing
 * silently with an empty trip list.
 */
export function BackendGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    initBackend()
      .then(() => !cancelled && setState('ready'))
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[gtp] backend setup failed', err);
        setMessage(err instanceof Error ? err.message : String(err));
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="xs">
          <Loader />
          <Text c="dimmed" size="sm">
            {backendKind === 'supabase' ? 'Connecting…' : 'Loading…'}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (state === 'error') {
    return (
      <Center mih="60vh">
        <Card maw={560} padding="xl" withBorder>
          <Stack>
            <Alert color="red" icon={<IconAlertCircle />} title="Can't reach the trip database">
              {message}
            </Alert>
            <Text size="sm" c="dimmed">
              Check <Code>VITE_SUPABASE_URL</Code> and <Code>VITE_SUPABASE_ANON_KEY</Code> in your
              <Code>.env</Code>, that anonymous sign-ins are enabled in the Supabase dashboard, and that the
              migrations in <Code>supabase/migrations</Code> have been applied. Set{' '}
              <Code>VITE_BACKEND=local</Code> to work offline instead.
            </Text>
            <Button variant="default" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </Stack>
        </Card>
      </Center>
    );
  }

  return <>{children}</>;
}
