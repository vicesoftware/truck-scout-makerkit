'use client';

import { useMemo, useState } from 'react';

import { CaretSortIcon, PersonIcon } from '@radix-ui/react-icons';
import { CheckCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@kit/ui/command';
import { If } from '@kit/ui/if';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { Separator } from '@kit/ui/separator';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { CreateTeamAccountDialog } from '../../../team-accounts/src/components/create-team-account-dialog';
import { usePersonalAccountData } from '../hooks/use-personal-account-data';

interface AccountSelectorProps {
  accounts: Array<{
    label: string | null;
    value: string | null;
    image?: string | null;
  }>;

  features: {
    enableTeamCreation: boolean;
  };

  userId: string;
  selectedAccount?: string;
  collapsed?: boolean;
  className?: string;
  collisionPadding?: number;

  onAccountChange: (value: string | undefined) => void;
}

const PERSONAL_ACCOUNT_SLUG = 'personal';

export function AccountSelector({
  accounts,
  selectedAccount,
  onAccountChange,
  userId,
  className,
  features = {
    enableTeamCreation: true,
  },
  collapsed = false,
  collisionPadding = 20,
}: React.PropsWithChildren<AccountSelectorProps>) {
  const [open, setOpen] = useState<boolean>(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);
  const { t } = useTranslation('teams');
  const personalData = usePersonalAccountData(userId);

  const value = useMemo(() => {
    return selectedAccount ?? PERSONAL_ACCOUNT_SLUG;
  }, [selectedAccount]);

  const Icon = (props: { item: string }) => {
    return (
      <CheckCircle
        className={cn(
          'ml-auto h-4 w-4',
          value === props.item ? 'opacity-100' : 'opacity-0',
        )}
      />
    );
  };

  const selected = accounts.find((account) => account.value === value);
  const pictureUrl = personalData.data?.picture_url;

  const PersonalAccountAvatar = () =>
    pictureUrl ? (
      <UserAvatar pictureUrl={pictureUrl} />
    ) : (
      <PersonIcon className="h-5 min-h-5 w-5 min-w-5" />
    );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            data-test={'account-selector-trigger'}
            size={collapsed ? 'icon' : 'default'}
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'dark:shadow-primary/10 group w-full min-w-0 px-2 lg:w-auto lg:max-w-fit',
              {
                'justify-start': !collapsed,
                'm-auto justify-center px-2 lg:w-full': collapsed,
              },
              className,
            )}
          >
            <If
              condition={selected}
              fallback={
                <span className={'flex max-w-full items-center space-x-4'}>
                  <PersonalAccountAvatar />

                  <span
                    className={cn('truncate', {
                      hidden: collapsed,
                    })}
                  >
                    <Trans i18nKey={'teams:personalAccount'} />
                  </span>
                </span>
              }
            >
              {(account) => (
                <span className={'flex max-w-full items-center space-x-4'}>
                  <Avatar className={'h-6 w-6 rounded-sm'}>
                    <AvatarImage src={account.image ?? undefined} />

                    <AvatarFallback
                      className={'group-hover:bg-background rounded-sm'}
                    >
                      {account.label ? account.label[0] : ''}
                    </AvatarFallback>
                  </Avatar>

                  <span
                    className={cn('truncate', {
                      hidden: collapsed,
                    })}
                  >
                    {account.label}
                  </span>
                </span>
              )}
            </If>

            <CaretSortIcon
              className={cn('ml-2 h-4 w-4 shrink-0 opacity-50', {
                hidden: collapsed,
              })}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          data-test={'account-selector-content'}
          className="w-full p-0"
          collisionPadding={collisionPadding}
        >
          <Command>
            <CommandInput placeholder={t('searchAccount')} className="h-9" />

            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => onAccountChange(undefined)}
                  value={PERSONAL_ACCOUNT_SLUG}
                >
                  <PersonalAccountAvatar />

                  <span className={'ml-2'}>
                    <Trans i18nKey={'teams:personalAccount'} />
                  </span>

                  <Icon item={PERSONAL_ACCOUNT_SLUG} />
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <If condition={accounts.length > 0}>
                <CommandGroup
                  heading={
                    <Trans
                      i18nKey={'teams:yourTeams'}
                      values={{ teamsCount: accounts.length }}
                    />
                  }
                >
                  {(accounts ?? []).map((account) => (
                    <CommandItem
                      data-test={'account-selector-team'}
                      data-name={account.label}
                      data-slug={account.value}
                      className={cn(
                        'group my-1 flex justify-between transition-colors',
                        {
                          ['bg-muted']: value === account.value,
                        },
                      )}
                      key={account.value}
                      value={account.value ?? ''}
                      onSelect={(currentValue) => {
                        setOpen(false);

                        if (onAccountChange) {
                          onAccountChange(currentValue);
                        }
                      }}
                    >
                      <div className={'flex items-center'}>
                        <Avatar className={'mr-2 h-6 w-6 rounded-sm'}>
                          <AvatarImage src={account.image ?? undefined} />

                          <AvatarFallback
                            className={cn('rounded-sm', {
                              ['bg-background']: value === account.value,
                              ['group-hover:bg-background']:
                                value !== account.value,
                            })}
                          >
                            {account.label ? account.label[0] : ''}
                          </AvatarFallback>
                        </Avatar>

                        <span className={'mr-2 max-w-[165px] truncate'}>
                          {account.label}
                        </span>
                      </div>

                      <Icon item={account.value ?? ''} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </If>
            </CommandList>
          </Command>

          <Separator />

          <If condition={features.enableTeamCreation}>
            <div className={'p-1'}>
              <Button
                data-test={'create-team-account-trigger'}
                variant="ghost"
                size={'sm'}
                className="w-full justify-start text-sm font-normal"
                onClick={() => {
                  setIsCreatingAccount(true);
                  setOpen(false);
                }}
              >
                <Plus className="mr-3 h-4 w-4" />

                <span>
                  <Trans i18nKey={'teams:createTeam'} />
                </span>
              </Button>
            </div>
          </If>
        </PopoverContent>
      </Popover>

      <If condition={features.enableTeamCreation}>
        <CreateTeamAccountDialog
          isOpen={isCreatingAccount}
          setIsOpen={setIsCreatingAccount}
        />
      </If>
    </>
  );
}

function UserAvatar(props: { pictureUrl?: string }) {
  return (
    <Avatar className={'h-6 w-6 rounded-sm'}>
      <AvatarImage src={props.pictureUrl} />
    </Avatar>
  );
}
