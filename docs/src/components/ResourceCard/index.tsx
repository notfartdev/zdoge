import React from 'react';
import { 
  FileText, 
  Coins, 
  MessageCircle, 
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Shield,
  LucideIcon 
} from 'lucide-react';
import styles from './styles.module.css';

const iconMap: Record<string, LucideIcon> = {
  FileText,
  Coins,
  MessageCircle,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Shield,
};

interface ResourceCardProps {
  title: string;
  description: string;
  href: string;
  icon: keyof typeof iconMap;
}

export default function ResourceCard({
  title,
  description,
  href,
  icon,
}: ResourceCardProps) {
  const IconComponent = iconMap[icon] || FileText;

  return (
    <a href={href} className={styles.resourceCard}>
      <div className={styles.iconWrapper}>
        <IconComponent size={24} />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
    </a>
  );
}

