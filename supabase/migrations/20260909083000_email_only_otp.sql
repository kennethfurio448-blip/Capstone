-- MedTrack now uses Gmail OTP exclusively. Remove all persisted phone and SMS
-- fields introduced by the earlier dual-channel OTP migration.

delete from public.otp_challenges
where channel = 'sms';

alter table public.otp_challenges
    drop constraint if exists otp_challenges_channel_check;

alter table public.otp_challenges
    drop column if exists channel;

drop index if exists public.profiles_phone_number_unique_idx;

alter table public.profiles
    drop column if exists phone_number;

