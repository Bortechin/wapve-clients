type MentionMember = {
  id: string;
  publicId: string;
  displayName: string;
};

type MentionRole = {
  id: string;
  name: string;
};

type MentionChannel = {
  id: string;
  publicId: string;
  name: string;
  type?: 'TEXT' | 'VOICE';
};

export type ComposerMentionAlias = {
  token: string;
  label: string;
};

export function buildComposerMentionAliases(
  members: MentionMember[],
  roles: MentionRole[],
  channels: MentionChannel[],
): ComposerMentionAlias[] {
  const aliases: ComposerMentionAlias[] = [];
  for (const member of members) {
    const label = `@${member.displayName}`;
    aliases.push({ token: `<@${member.id}>`, label });
    aliases.push({ token: `<@${member.publicId}>`, label });
  }
  for (const role of roles) {
    aliases.push({ token: `<@${role.id}>`, label: `@${role.name.replace(/^@/u, '')}` });
  }
  for (const channel of channels) {
    const label = channel.type === 'VOICE' ? `🎧 ${channel.name}` : `#${channel.name}`;
    aliases.push({ token: `<#${channel.id}>`, label });
    aliases.push({ token: `<#${channel.publicId}>`, label });
  }
  return aliases;
}

export function displayComposerMentions(
  value: string,
  aliases: ComposerMentionAlias[],
): string {
  return aliases
    .slice()
    .sort((left, right) => right.token.length - left.token.length)
    .reduce((result, alias) => result.replaceAll(alias.token, alias.label), value);
}

export function canonicalizeComposerMentions(
  value: string,
  aliases: ComposerMentionAlias[],
): string {
  const uniqueLabels = new Set<string>();
  return aliases
    .slice()
    .sort((left, right) => right.label.length - left.label.length)
    .reduce((result, alias) => {
      if (uniqueLabels.has(alias.label)) return result;
      uniqueLabels.add(alias.label);
      return result.replaceAll(alias.label, alias.token);
    }, value);
}

export function rawOffsetFromDisplay(
  displayValue: string,
  displayOffset: number,
  aliases: ComposerMentionAlias[],
): number {
  return canonicalizeComposerMentions(displayValue.slice(0, displayOffset), aliases).length;
}

export function displayOffsetFromRaw(
  rawValue: string,
  rawOffset: number,
  aliases: ComposerMentionAlias[],
): number {
  return displayComposerMentions(rawValue.slice(0, rawOffset), aliases).length;
}
