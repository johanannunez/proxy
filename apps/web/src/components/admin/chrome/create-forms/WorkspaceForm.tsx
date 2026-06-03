'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspace } from '@/app/(admin)/admin/workspaces/[workspaceId]/workspace-actions';
import { CustomSelect } from '@/components/admin/CustomSelect';
import styles from './ContactForm.module.css';

const BUSINESS_ENTITY_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'llc', label: 'LLC' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'trust', label: 'Trust' },
  { value: 's_corp', label: 'S Corporation' },
  { value: 'c_corp', label: 'C Corporation' },
] as const;

type BusinessEntityType = 'individual' | 'llc' | 'partnership' | 'trust' | 's_corp' | 'c_corp';

const PERSON_ROLES = [
  { value: 'primary_owner', label: 'Primary owner' },
  { value: 'co_owner', label: 'Co-owner' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'manager', label: 'Manager' },
  { value: 'other', label: 'Other' },
] as const;

type PersonRole = 'primary_owner' | 'co_owner' | 'spouse' | 'accountant' | 'manager' | 'other';

const RESPONSIBILITIES = [
  { value: 'day_to_day', label: 'Day to day' },
  { value: 'finance', label: 'Finance' },
  { value: 'decision_maker', label: 'Decision maker' },
  { value: 'property_setup', label: 'Property setup' },
] as const;

type Responsibility = 'day_to_day' | 'finance' | 'decision_maker' | 'property_setup';

function isBusinessEntityType(value: string): value is BusinessEntityType {
  return BUSINESS_ENTITY_TYPES.some((type) => type.value === value);
}

function isPersonRole(value: string): value is PersonRole {
  return PERSON_ROLES.some((role) => role.value === value);
}

function toggleResponsibility(
  current: Responsibility[],
  next: Responsibility,
): Responsibility[] {
  return current.includes(next)
    ? current.filter((item) => item !== next)
    : [...current, next];
}

export function WorkspaceForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessEntityType>('individual');
  const [personName, setPersonName] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [personRole, setPersonRole] = useState<PersonRole>('primary_owner');
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(['day_to_day']);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!name.trim() || !personName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createWorkspace({
        name,
        type,
        firstPerson: {
          fullName: personName,
          email: personEmail || null,
          phone: personPhone || null,
          relationshipRole: personRole,
          responsibilities,
          portalAccess: 'not_invited',
        },
      });
      if ('error' in result) {
        setError(result.error ?? 'Something went wrong');
        return;
      }
      router.push(`/admin/workspaces/${result.workspaceId}`);
      onClose();
    });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="workspace-name">Workspace name</label>
        <input
          id="workspace-name"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Thompson Family"
          autoFocus
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="business-entity-type">Business entity type</label>
        <CustomSelect
          id="business-entity-type"
          value={type}
          options={[...BUSINESS_ENTITY_TYPES]}
          onChange={(next) => {
            if (isBusinessEntityType(next)) {
              setType(next);
            }
          }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="workspace-person-name">First person</label>
        <input
          id="workspace-person-name"
          className={styles.input}
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder="e.g. Maya Thompson"
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="workspace-person-email">Email</label>
          <input
            id="workspace-person-email"
            type="email"
            className={styles.input}
            value={personEmail}
            onChange={(e) => setPersonEmail(e.target.value)}
            placeholder="maya@example.com"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="workspace-person-phone">Phone</label>
          <input
            id="workspace-person-phone"
            type="tel"
            className={styles.input}
            value={personPhone}
            onChange={(e) => setPersonPhone(e.target.value)}
            placeholder="(555) 555-0100"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="workspace-person-role">Relationship</label>
        <CustomSelect
          id="workspace-person-role"
          value={personRole}
          options={[...PERSON_ROLES]}
          onChange={(next) => {
            if (isPersonRole(next)) {
              setPersonRole(next);
            }
          }}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Responsibilities</span>
        <div className={styles.choiceGrid}>
          {RESPONSIBILITIES.map((item) => {
            const selected = responsibilities.includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                className={`${styles.choiceChip} ${selected ? styles.choiceChipSelected : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  setResponsibilities((current) =>
                    toggleResponsibility(current, item.value),
                  );
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.note}>
        Workspace access stays off until you invite this person.
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={!name.trim() || !personName.trim() || isPending}
        >
          {isPending ? 'Creating…' : 'Create Workspace'}
        </button>
      </div>
    </form>
  );
}
