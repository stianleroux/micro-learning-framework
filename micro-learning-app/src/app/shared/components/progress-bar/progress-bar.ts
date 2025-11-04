import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  imports: [CommonModule],
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
})
export class ProgressBarComponent {
  @Input() percentage: number = 0;
  @Input() color: string = '#007bff';
  @Input() height: string = '8px';
  @Input() showText: boolean = false;
  @Input() animated: boolean = false;

  get clampedPercentage(): number {
    return Math.max(0, Math.min(100, this.percentage));
  }

  get progressStyle(): Record<string, string> {
    return {
      width: `${this.clampedPercentage}%`,
      backgroundColor: this.color,
      height: this.height,
    };
  }

  get containerStyle(): Record<string, string> {
    return {
      height: this.height,
    };
  }
}
