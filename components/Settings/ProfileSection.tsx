import React, { useRef, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadAvatar, updateProfile } from '../../lib/api';
import { useToast } from '../Toast';
import { Avatar } from '../ui/Avatar';
import type { Member } from '../../lib/types';
import { SectionHead, Field, Eyebrow } from './parts';

export interface ProfileFields {
  name: string;
  title: string;
  pronouns: string;
  team: string;
  status: string;
}

interface ProfileSectionProps {
  supabase: SupabaseClient;
  me: Member;
  fields: ProfileFields;
  onChange: (patch: Partial<ProfileFields>) => void;
  /** Pull fresh me from the app context after an avatar upload. */
  onAvatarChanged: (url: string) => void;
}

/** Profile section: avatar drop/upload, identity fields, live teammate-preview card. */
export const ProfileSection: React.FC<ProfileSectionProps> = ({
  supabase, me, fields, onChange, onAvatarChanged,
}) => {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const doUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAvatar(supabase, file);
      onAvatarChanged(url);
      showToast('Profile photo updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload photo.', 'error');
    } finally {
      setUploading(false);
    }
  }, [supabase, onAvatarChanged, showToast]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const removePhoto = useCallback(async () => {
    try {
      await updateProfile(supabase, { avatar: '' });
      onAvatarChanged('');
      showToast('Profile photo removed.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove photo.', 'error');
    }
  }, [supabase, onAvatarChanged, showToast]);

  return (
    <>
      <SectionHead
        title="Your profile"
        lead="This is how you appear to teammates across notes, comments and the live cursors."
      />

      {/* avatar row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          paddingBottom: 26,
          marginBottom: 26,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={onFileInput}
          style={{ display: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          aria-label="Upload profile photo. Drag an image here or click to browse."
          style={{
            position: 'relative',
            width: 84,
            height: 84,
            flex: '0 0 auto',
            borderRadius: '50%',
            padding: 0,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            boxShadow: dragOver
              ? '0 0 0 2px var(--accent),0 10px 26px -10px rgba(0,0,0,0.7)'
              : '0 0 0 2px rgba(110,168,254,0.55),0 10px 26px -10px rgba(0,0,0,0.7)',
            outline: 'none',
            opacity: uploading ? 0.6 : 1,
            transition: 'box-shadow 0.16s ease',
          }}
        >
          <Avatar name={me.name} color={me.color} avatarUrl={me.avatarUrl} size={84} ring={false} />
          {dragOver && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(8,11,18,0.55)',
                fontSize: 10,
                fontWeight: 700,
                color: '#cdd6e3',
              }}
            >
              Drop
            </span>
          )}
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#eef2f8', marginBottom: 3 }}>Profile photo</div>
          <div style={{ fontSize: 12, color: '#8b97ab', marginBottom: 12 }}>
            Drag an image onto the circle, or click it to browse. PNG or JPG, up to 5MB.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="cb-set-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 38,
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#dbe2ec',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={removePhoto}
              disabled={uploading || !me.avatarUrl}
              className="cb-set-remove"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 38,
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 10,
                cursor: me.avatarUrl ? 'pointer' : 'not-allowed',
                fontSize: 12.5,
                fontWeight: 600,
                color: '#9aa6ba',
                background: 'transparent',
                border: 'none',
                opacity: me.avatarUrl ? 1 : 0.5,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
        <Field label="DISPLAY NAME" value={fields.name} onChange={(v) => onChange({ name: v })} autoComplete="name" />
        <Field label="TITLE" value={fields.title} onChange={(v) => onChange({ title: v })} />
        <Field label="PRONOUNS" value={fields.pronouns} onChange={(v) => onChange({ pronouns: v })} />
        <Field label="TEAM" value={fields.team} onChange={(v) => onChange({ team: v })} />
        <Field
          label="STATUS"
          value={fields.status}
          onChange={(v) => onChange({ status: v })}
          placeholder="What are you working on?"
          full
        />
      </div>

      {/* preview */}
      <div style={{ marginTop: 26 }}>
        <Eyebrow style={{ marginBottom: 10 }}>HOW TEAMMATES SEE YOU</Eyebrow>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            padding: 14,
            borderRadius: 14,
            background: 'rgba(110,168,254,0.06)',
            border: '1px solid rgba(110,168,254,0.18)',
          }}
        >
          <Avatar name={fields.name} color={me.color} avatarUrl={me.avatarUrl} size={44} online />
          <div style={{ minWidth: 0, lineHeight: 1.3 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#eef2f8' }}>
              {fields.name || 'Unnamed'}{' '}
              {fields.pronouns && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#8b97ab' }}>{fields.pronouns}</span>
              )}
            </div>
            {(fields.title || fields.team) && (
              <div style={{ fontSize: 12, color: '#9bbcf2' }}>
                {[fields.title, fields.team].filter(Boolean).join(' · ')}
              </div>
            )}
            {fields.status && (
              <div style={{ fontSize: 11.5, color: '#8b97ab', marginTop: 2 }}>{fields.status}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSection;
