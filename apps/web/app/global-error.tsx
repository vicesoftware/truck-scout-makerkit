'use client';

import Link from 'next/link';

import { ArrowLeft, MessageCircle } from 'lucide-react';

import { useCaptureException } from '@kit/monitoring/hooks';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { SiteHeader } from '~/(marketing)/_components/site-header';

const GlobalErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useCaptureException(error);

  return (
    <html>
      <body>
        <div className={'flex h-screen flex-1 flex-col'}>
          <SiteHeader />

          <div
            className={
              'container m-auto flex w-full flex-1 flex-col items-center justify-center'
            }
          >
            <div className={'flex flex-col items-center space-y-8'}>
              <div>
                <h1 className={'font-heading text-9xl font-semibold'}>
                  <Trans i18nKey={'common:errorPageHeading'} />
                </h1>
              </div>

              <div className={'flex flex-col items-center space-y-8'}>
                <div
                  className={
                    'flex max-w-xl flex-col items-center space-y-1 text-center'
                  }
                >
                  <div>
                    <Heading level={2}>
                      <Trans i18nKey={'common:genericError'} />
                    </Heading>
                  </div>

                  <p className={'text-lg text-muted-foreground'}>
                    <Trans i18nKey={'common:genericErrorSubHeading'} />
                  </p>
                </div>

                <div>
                  <Button
                    className={'w-full'}
                    variant={'default'}
                    onClick={reset}
                  >
                    <ArrowLeft className={'mr-2 h-4'} />

                    <Trans i18nKey={'common:goBack'} />
                  </Button>

                  <Button className={'w-full'} variant={'outline'} asChild>
                    <Link href={'/contact'}>
                      <MessageCircle className={'mr-2 h-4'} />

                      <Trans i18nKey={'common:contactUs'} />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default GlobalErrorPage;
